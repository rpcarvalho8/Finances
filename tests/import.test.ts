import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic users and synthetic bank files only (tests/fixtures/abanca).
const PW = 'synthetic-password-123'
const ORIGIN = 'http://localhost:3002'
const FIX = path.resolve('tests/fixtures/abanca')
const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(FIX, name)))

let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-import-'))
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

async function setup(opts: { newHousehold?: boolean; email?: string } = {}) {
  const { addUser } = await import('@/lib/auth/users')
  const { createSession } = await import('@/lib/auth/session')
  const { getDb } = await import('@/lib/db')
  const email = opts.email ?? 'a@example.test'
  const id = await addUser(email.split('@')[0].toUpperCase() + ' Exemplo', email, PW, { newHousehold: opts.newHousehold })
  const { token } = await createSession(id, null)
  const hh = Number((await getDb().execute({ sql: `SELECT household_id FROM household_members WHERE user_id = ?`, args: [id] })).rows[0].household_id)
  const joint = Number((await getDb().execute({ sql: `SELECT id FROM ledger_accounts WHERE household_id = ? AND owner_user_id IS NULL`, args: [hh] })).rows[0].id)
  return { id, token, hh, joint }
}

function upload(token: string, fields: Record<string, string>, file?: { name: string; bytes: Uint8Array }) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('file', new Blob([file.bytes as BlobPart]), file.name)
  return new NextRequest(`${ORIGIN}/api/import`, { method: 'POST', headers: { host: 'localhost:3002', origin: ORIGIN, cookie: `fos_session=${token}` }, body: fd })
}

describe('CSV helpers', () => {
  it('parses quoted fields with commas, doubled quotes and CRLF', async () => {
    const { parseCsv } = await import('@/lib/import/csv')
    const rows = parseCsv('a,"b, c","d ""e"""\r\n\r\n1,2,3\n')
    expect(rows).toEqual([
      { line: 1, cells: ['a', 'b, c', 'd "e"'] },
      { line: 3, cells: ['1', '2', '3'] },
    ])
  })
  it('rounds float noise to the cent, keeps the sign, rejects real sub-cent values', async () => {
    const { parseNoisyAmountToCents } = await import('@/lib/import/csv')
    expect(parseNoisyAmountToCents('-12.340000000000002 €')).toBe(-1234)
    expect(parseNoisyAmountToCents('1234.5 €')).toBe(123450)
    expect(parseNoisyAmountToCents('0.30000000000000004 €')).toBe(30)
    expect(parseNoisyAmountToCents('-45.29999999999999 €')).toBe(-4530)
    expect(parseNoisyAmountToCents('12,5')).toBe(1250)
    expect(parseNoisyAmountToCents('-1.234 €')).toBeNull()
    expect(parseNoisyAmountToCents('abc €')).toBeNull()
    expect(parseNoisyAmountToCents('')).toBeNull()
  })
  it('detects UTF-8 strictly and decodes Windows-1252 without ICU', async () => {
    const { decodeText, isValidUtf8 } = await import('@/lib/import/csv')
    expect(isValidUtf8(new TextEncoder().encode('Operação € ç'))).toBe(true)
    expect(isValidUtf8(new Uint8Array([0x4f, 0x70, 0xe7, 0xe3, 0x6f]))).toBe(false) // cp1252 "Opçã o"
    expect(isValidUtf8(new Uint8Array([0xc0, 0x80]))).toBe(false) // overlong
    expect(isValidUtf8(new Uint8Array([0xe2, 0x82]))).toBe(false) // truncated
    expect(decodeText(new Uint8Array([0x80, 0x20, 0xe7, 0xe3, 0x93, 0x94]))).toBe('€ çã“”')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A')
  })
  it('validates real calendar dates', async () => {
    const { dmyToIso } = await import('@/lib/import/csv')
    expect(dmyToIso('04-01-2026')).toBe('2026-01-04')
    expect(dmyToIso('4/1/2026')).toBe('2026-01-04')
    expect(dmyToIso('31-02-2026')).toBeNull()
    expect(dmyToIso('2026-01-04')).toBeNull()
  })
})

describe('ABANCA parser', () => {
  it('reads the synthetic export: operation date, signed cents, quoted descriptions', async () => {
    const { parseAbancaCsv } = await import('@/lib/import/abanca')
    const r = parseAbancaCsv(fixture('basico.csv'))
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(6)
    const sup = r.rows.find((x) => x.description === 'SUPERMERCADO EXEMPLO')!
    expect(sup.bookedOn).toBe('2026-01-04') // "Data da operação", not "Data"
    expect(sup.amountCents).toBe(-4530)
    expect(sup.balanceCents).toBe(95470)
    expect(r.rows.find((x) => x.description.startsWith('CONDOMINIO'))!.description).toBe('CONDOMINIO EXEMPLO, TRF. PERIODICO: 2')
    expect(r.rows.find((x) => x.description.startsWith('LOJA'))!.description).toBe('LOJA "EXEMPLO" ÁGUA')
  })
  it('handles Windows-1252, a BOM and junk lines before the header the same way', async () => {
    const { parseAbancaCsv } = await import('@/lib/import/abanca')
    const a = parseAbancaCsv(fixture('basico.csv')).rows.map(({ line: _l, ...r }) => r)
    const b = parseAbancaCsv(fixture('cp1252.csv')).rows.map(({ line: _l, ...r }) => r)
    expect(b).toEqual(a)
  })
  it('reports bad lines without stopping', async () => {
    const { parseAbancaCsv } = await import('@/lib/import/abanca')
    const r = parseAbancaCsv(fixture('erros.csv'))
    expect(r.rows).toHaveLength(1)
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5])
    expect(r.warnings.join(' ')).toMatch(/0,00/)
  })
  it('says so when the file is not an ABANCA export', async () => {
    const { parseAbancaCsv } = await import('@/lib/import/abanca')
    const r = parseAbancaCsv(new TextEncoder().encode('foo,bar\n1,2\n'))
    expect(r.rows).toEqual([])
    expect(r.warnings[0]).toMatch(/cabeçalho/)
  })
})

describe('import pipeline', () => {
  it('previews without writing, commits once, and never duplicates on re-import or overlap', async () => {
    const u = await setup()
    const { previewImport, commitImport } = await import('@/lib/import/pipeline')
    const { abancaCsv } = await import('@/lib/import/abanca')
    const { listMovements } = await import('@/lib/ledger')

    const p = await previewImport(u.hh, u.joint, abancaCsv, fixture('basico.csv'))
    expect(p.counts).toEqual({ total: 6, new: 6, duplicate: 0, error: 0 })
    expect(p.period).toEqual({ from: '2026-01-02', to: '2026-01-06' })
    expect(p.rows.map((r) => r.date)).toEqual([...p.rows.map((r) => r.date)].sort())
    expect(p.warnings).toEqual([])
    expect(await listMovements(u.hh, {})).toHaveLength(0)

    const c1 = await commitImport(u.hh, u.id, u.joint, abancaCsv, fixture('basico.csv'), { expectedSha256: p.fileSha256, fileName: 'basico.csv' })
    expect(c1).toMatchObject({ inserted: 6, duplicate: 0 })
    const all = await listMovements(u.hh, {})
    expect(all).toHaveLength(6)
    expect(all.every((m) => m.owner === 'conjunta')).toBe(true)
    expect(all.filter((m) => m.description === 'CAFE EXEMPLO')).toHaveLength(2) // two identical same-day rows both kept

    // Same file again (re-encoded): nothing new.
    const p2 = await previewImport(u.hh, u.joint, abancaCsv, fixture('cp1252.csv'))
    expect(p2.counts).toMatchObject({ new: 0, duplicate: 6 })
    const p3 = await previewImport(u.hh, u.joint, abancaCsv, fixture('basico.csv'))
    expect(p3.alreadyImported).toBe(true)
    expect((await commitImport(u.hh, u.id, u.joint, abancaCsv, fixture('basico.csv'), { expectedSha256: p3.fileSha256 })).inserted).toBe(0)

    // Overlapping export: only the new row enters.
    const p4 = await previewImport(u.hh, u.joint, abancaCsv, fixture('sobreposto.csv'))
    expect(p4.counts).toMatchObject({ new: 1, duplicate: 2 })
    expect((await commitImport(u.hh, u.id, u.joint, abancaCsv, fixture('sobreposto.csv'), { expectedSha256: p4.fileSha256 })).inserted).toBe(1)
    const total = await listMovements(u.hh, {})
    expect(total).toHaveLength(7)
    const { sumCents } = await import('@/lib/money')
    expect(sumCents(total.map((m) => m.amount_cents))).toBe(94030 - 100000) // closing − opening balance
  })

  it('warns when balances do not chain (missing movement)', async () => {
    const { balanceWarnings } = await import('@/lib/import/pipeline')
    const row = (amountCents: number, balanceCents: number) => ({ line: 1, bookedOn: '2026-01-01', valueOn: null, description: 'X', amountCents, balanceCents })
    expect(balanceWarnings([row(100, 1100), row(-50, 1050)])).toEqual([])
    expect(balanceWarnings([row(100, 1100), row(-50, 900)])[0]).toMatch(/faltar/)
  })

  it('refuses a commit whose file differs from the preview', async () => {
    const u = await setup()
    const { previewImport, commitImport } = await import('@/lib/import/pipeline')
    const { abancaCsv } = await import('@/lib/import/abanca')
    const p = await previewImport(u.hh, u.joint, abancaCsv, fixture('basico.csv'))
    await expect(commitImport(u.hh, u.id, u.joint, abancaCsv, fixture('sobreposto.csv'), { expectedSha256: p.fileSha256 })).rejects.toThrow(/mudou/)
  })
})

describe('import API', () => {
  it('requires a session and stays inside the household', async () => {
    const { POST } = await import('@/app/api/import/route')
    const a = await setup()
    const b = await setup({ newHousehold: true, email: 'b@example.test' })
    const file = { name: 'basico.csv', bytes: fixture('basico.csv') }
    expect((await POST(upload('x'.repeat(43), { source: 'abanca_csv', account_id: String(a.joint), mode: 'preview' }, file), {})).status).toBe(401)
    // A cannot import into (or probe) B's account.
    expect((await POST(upload(a.token, { source: 'abanca_csv', account_id: String(b.joint), mode: 'preview' }, file), {})).status).toBe(404)
    const prev = await POST(upload(a.token, { source: 'abanca_csv', account_id: String(a.joint), mode: 'preview' }, file), {})
    expect(prev.status).toBe(200)
    const { fileSha256 } = await prev.json()
    const commit = await POST(upload(a.token, { source: 'abanca_csv', account_id: String(a.joint), mode: 'commit', sha256: fileSha256 }, file), {})
    expect(commit.status).toBe(200)
    expect((await commit.json()).inserted).toBe(6)
    const { listMovements } = await import('@/lib/ledger')
    expect(await listMovements(b.hh, {})).toHaveLength(0)
  })

  it('validates the request', async () => {
    const { POST } = await import('@/app/api/import/route')
    const a = await setup()
    const file = { name: 'basico.csv', bytes: fixture('basico.csv') }
    const base = { source: 'abanca_csv', account_id: String(a.joint), mode: 'preview' }
    expect((await POST(upload(a.token, base), {})).status).toBe(400) // no file
    expect((await POST(upload(a.token, { ...base, source: 'nope' }, file), {})).status).toBe(400)
    expect((await POST(upload(a.token, { ...base, account_id: 'abc' }, file), {})).status).toBe(400)
    expect((await POST(upload(a.token, { ...base, mode: 'commit' }, file), {})).status).toBe(400) // no sha256
    expect((await POST(upload(a.token, base, { name: 'big.csv', bytes: new Uint8Array(5 * 1024 * 1024 + 1) }), {})).status).toBe(413)
  })
})
