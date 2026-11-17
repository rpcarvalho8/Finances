import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic meal-card files only (tests/fixtures/pluxee).
const FIX = path.resolve('tests/fixtures/pluxee')
const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(FIX, name)))
const ORIGIN = 'http://localhost:3002'

describe('Portuguese amounts', () => {
  it('parses decimal comma and thousands dot exactly', async () => {
    const { parsePtAmountToCents } = await import('@/lib/import/pluxee')
    expect(parsePtAmountToCents('-23,45 €')).toBe(-2345)
    expect(parsePtAmountToCents('1.000,05 €')).toBe(100005)
    expect(parsePtAmountToCents('150,00')).toBe(15000)
    expect(parsePtAmountToCents('8,5')).toBe(850)
    expect(parsePtAmountToCents('12.5')).toBe(1250)
    expect(parsePtAmountToCents('1,234')).toBeNull()
    expect(parsePtAmountToCents('')).toBeNull()
  })
})

describe('Pluxee parser', () => {
  it('skips the title lines, rebuilds split descriptions and types each row', async () => {
    const { parsePluxeeCsv } = await import('@/lib/import/pluxee')
    const r = parsePluxeeCsv(fixture('com-sinais.csv'))
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.rows.map((x) => [x.bookedOn, x.description, x.amountCents, x.kind, x.category ?? null])).toEqual([
      ['2026-01-02', 'Carregamento de EMPRESA EXEMPLO, LDA', 115000, 'in_kind_income', null],
      ['2026-01-05', 'SUPERMERCADO EXEMPLO A', -2345, 'expense', 'Alimentação'],
      ['2026-01-09', 'RESTAURANTE EXEMPLO', -850, 'expense', 'Alimentação'],
      ['2026-01-15', 'Estorno SUPERMERCADO EXEMPLO A', 200, 'refund', null],
      ['2026-01-20', 'SUPERMERCADO EXEMPLO B', -100005, 'expense', 'Alimentação'],
    ])
    expect(r.rows[0].balanceCents).toBe(116000)
  })

  it('reads unquoted amounts broken at the decimal comma and infers signs when there are none', async () => {
    const { parsePluxeeCsv } = await import('@/lib/import/pluxee')
    const r = parsePluxeeCsv(fixture('sem-sinais.csv'))
    expect(r.errors).toEqual([])
    expect(r.warnings.join(' ')).toMatch(/sinais/)
    expect(r.rows.map((x) => [x.description, x.amountCents, x.balanceCents])).toEqual([
      ['Carregamento de EMPRESA EXEMPLO, LDA', 15000, 16000],
      ['SUPERMERCADO EXEMPLO A', -2345, 13655],
      ['RESTAURANTE EXEMPLO', -850, 12805],
    ])
  })

  it('accepts semicolons and Windows-1252, and reports bad lines', async () => {
    const { parsePluxeeCsv } = await import('@/lib/import/pluxee')
    const r = parsePluxeeCsv(fixture('ponto-e-virgula.csv'))
    expect(r.rows.map((x) => x.amountCents)).toEqual([15000, -2345])
    expect(r.errors.map((e) => e.line)).toEqual([7, 8])
  })

  it('says so when the file is not a meal-card export', async () => {
    const { parsePluxeeCsv } = await import('@/lib/import/pluxee')
    expect(parsePluxeeCsv(new TextEncoder().encode('a,b\n1,2\n')).warnings[0]).toMatch(/cabeçalho/)
  })
})

describe('meal-card import end to end', () => {
  let tmpDir: string
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-pluxee-'))
    process.env.DATABASE_URL = `file:${path.join(tmpDir, 'finance.db')}`
    const { migrate } = await import('@/lib/migrate')
    await migrate({ backup: false })
  })
  afterEach(async () => {
    const { closeDb } = await import('@/lib/db')
    const { resetForeignKeysFlag } = await import('@/lib/auth/session')
    closeDb()
    resetForeignKeysFlag()
    delete process.env.DATABASE_URL
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a meal-card account, imports with kinds and categories, and dedupes', async () => {
    const { addUser } = await import('@/lib/auth/users')
    const { createSession } = await import('@/lib/auth/session')
    const uid = await addUser('Membro A', 'a@example.test', 'synthetic-password-123')
    const { token } = await createSession(uid, null)
    const headers = { host: 'localhost:3002', origin: ORIGIN, cookie: `fos_session=${token}`, 'content-type': 'application/json' }

    const acc = await import('@/app/api/accounts/route')
    const mk = (body: unknown) => acc.POST(new NextRequest(`${ORIGIN}/api/accounts`, { method: 'POST', headers, body: JSON.stringify(body) }), {})
    expect((await mk({ name: 'Cartão refeição', kind: 'gift_card', owner: 'membro-a' })).status).toBe(400)
    expect((await mk({ name: 'Cartão refeição', kind: 'meal_card', owner: 'outra-pessoa' })).status).toBe(400)
    const created = await mk({ name: 'Cartão refeição', kind: 'meal_card', owner: 'membro-a', institution: 'pluxee' })
    expect(created.status).toBe(200)
    const accountId = Number((await created.json()).id)
    expect((await mk({ name: 'cartão REFEIÇÃO', kind: 'meal_card', owner: 'membro-a' })).status).toBe(409)
    const list = (await (await acc.GET(new NextRequest(`${ORIGIN}/api/accounts`, { headers }), {})).json()) as Array<{ id: number; kind: string; ownerKey: string }>
    expect(list.find((a) => a.id === accountId)).toMatchObject({ kind: 'meal_card', ownerKey: 'membro-a' })

    const { getDb } = await import('@/lib/db')
    const hh = Number((await getDb().execute(`SELECT id FROM households LIMIT 1`)).rows[0].id)
    const { previewImport, commitImport } = await import('@/lib/import/pipeline')
    const { pluxeeCsv } = await import('@/lib/import/pluxee')
    const p = await previewImport(hh, accountId, pluxeeCsv, fixture('com-sinais.csv'))
    expect(p.counts).toMatchObject({ new: 5, error: 0 })
    expect(p.warnings).toEqual([])
    expect((await commitImport(hh, uid, accountId, pluxeeCsv, fixture('com-sinais.csv'), { expectedSha256: p.fileSha256 })).inserted).toBe(5)
    const { listMovements } = await import('@/lib/ledger')
    const rows = await listMovements(hh, {})
    expect(rows.find((m) => m.description.startsWith('Carregamento'))).toMatchObject({ type: 'in_kind_income', category_name: null, owner: 'membro-a' })
    expect(rows.find((m) => m.description === 'RESTAURANTE EXEMPLO')).toMatchObject({ type: 'expense', category_name: 'Alimentação' })
    expect((await previewImport(hh, accountId, pluxeeCsv, fixture('com-sinais.csv'))).counts.new).toBe(0)
  })
})
