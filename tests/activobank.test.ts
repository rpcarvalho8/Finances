import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic statement only: tests/fixtures/activobank/extrato-sintetico.pdf (generate.py).
const PDF = () => new Uint8Array(fs.readFileSync(path.resolve('tests/fixtures/activobank/extrato-sintetico.pdf')))

describe('ActivoBank helpers', () => {
  it('reads amounts with a space as thousands separator, exactly', async () => {
    const { amountToCents } = await import('@/lib/import/activobank')
    expect(amountToCents('1 556.00')).toBe(155600)
    expect(amountToCents('45.30')).toBe(4530)
    expect(amountToCents('1 234 567.89')).toBe(123456789)
  })
  it('takes the year from the statement period, across December → January', async () => {
    const { yearFor } = await import('@/lib/import/activobank')
    const p = { y1: 2025, m1: 12, y2: 2026, m2: 1 }
    expect(yearFor(12, p)).toBe(2025)
    expect(yearFor(1, p)).toBe(2026)
    expect(yearFor(5, { y1: 2026, m1: 1, y2: 2026, m2: 12 })).toBe(2026)
    expect(yearFor(5, null)).toBeNull()
  })
})

describe('ActivoBank PDF parser', () => {
  it('reads the checking section: dates, signs from columns, wrapped text, page break', async () => {
    const { parseActivoBankPdf } = await import('@/lib/import/activobank')
    const r = await parseActivoBankPdf(PDF())
    expect(r.errors).toEqual([])
    expect(r.sections?.map((s) => [s.label, s.rows])).toEqual([
      ['CONTA SIMPLES ···4567', 7],
      ['POUPEUP ···4321', 2],
    ])
    // The account number itself never leaves the parser.
    expect(JSON.stringify(r)).not.toContain('0001234567')
    expect(r.rows.map((x) => [x.bookedOn, x.valueOn, x.description, x.amountCents, x.balanceCents, x.kind ?? null])).toEqual([
      ['2025-12-01', '2025-12-01', 'TRF DE EMPRESA EXEMPLO', 155600, 255600, null],
      ['2025-12-03', '2025-12-03', 'COMPRA 1234 SUPERMERCADO EXEMPLO', -4530, 251070, null],
      ['2025-12-15', '2025-12-15', 'TRF P/ PoupeUp - Ferias', -10000, 241070, 'transfer'],
      ['2025-12-20', '2025-12-21', 'PAGAMENTO SERVICOS EXEMPLO REF. 000 111 222', -3000, 238070, null],
      ['2026-01-02', '2026-01-02', 'TRF DE PoupeUp - Ferias', 5000, 243070, 'transfer'],
      ['2026-01-05', '2026-01-05', 'COMPRA 1234 FARMACIA EXEMPLO', -1240, 241830, null],
      ['2026-01-05', '2026-01-05', 'COMPRA 1234 FARMACIA EXEMPLO', -1240, 240590, null],
    ])
    expect(r.warnings.join(' ')).toMatch(/2 contas/)
  })

  it('returns the PoupeUp section when asked, with internal transfers marked', async () => {
    const { parseActivoBankPdf } = await import('@/lib/import/activobank')
    const all = await parseActivoBankPdf(PDF())
    const key = all.sections![1].key
    const r = await parseActivoBankPdf(PDF(), { section: key })
    expect(r.section).toBe(key)
    expect(r.accountRef).toBe(key)
    expect(r.rows.map((x) => [x.description, x.amountCents, x.kind])).toEqual([
      ['TRF DE CONTA SIMPLES', 10000, 'transfer'],
      ['TRF P/ CONTA SIMPLES', -5000, 'transfer'],
    ])
    expect(r.warnings).toEqual([])
  })

  it('rejects files that are not a readable statement', async () => {
    const { parseActivoBankPdf } = await import('@/lib/import/activobank')
    expect((await parseActivoBankPdf(new TextEncoder().encode('not a pdf'))).warnings[0]).toMatch(/PDF/)
  })
})

describe('ActivoBank import end to end', () => {
  let tmpDir: string
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-activobank-'))
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

  it('imports each section into its own account, dedupes, and warns on the wrong account', async () => {
    const { addUser } = await import('@/lib/auth/users')
    const uid = await addUser('Membro A', 'a@example.test', 'synthetic-password-123')
    const { getDb } = await import('@/lib/db')
    const hh = Number((await getDb().execute(`SELECT id FROM households LIMIT 1`)).rows[0].id)
    const personal = Number((await getDb().execute({ sql: `SELECT id FROM ledger_accounts WHERE owner_user_id = ?`, args: [uid] })).rows[0].id)
    const { createAccount, resolveView, listMovements } = await import('@/lib/ledger')
    const savings = await createAccount(hh, { view: (await resolveView(hh, 'membro-a'))!, name: 'PoupeUp', kind: 'savings' })
    const { previewImport, commitImport } = await import('@/lib/import/pipeline')
    const { activoBankPdf } = await import('@/lib/import/activobank')

    const p1 = await previewImport(hh, personal, activoBankPdf, PDF())
    expect(p1.counts).toMatchObject({ new: 7, duplicate: 0, error: 0 })
    expect(p1.sections).toHaveLength(2)
    expect(p1.warnings.join(' ')).not.toMatch(/saldos não encadeiam/)
    await commitImport(hh, uid, personal, activoBankPdf, PDF(), { expectedSha256: p1.fileSha256 })

    const poupeKey = p1.sections![1].key
    const p2 = await previewImport(hh, savings, activoBankPdf, PDF(), { section: poupeKey })
    expect(p2.counts.new).toBe(2)
    await commitImport(hh, uid, savings, activoBankPdf, PDF(), { expectedSha256: p2.fileSha256, section: poupeKey })

    // Same file again: nothing new. Wrong section into an account already linked: warning.
    expect((await previewImport(hh, personal, activoBankPdf, PDF())).counts.new).toBe(0)
    const wrong = await previewImport(hh, personal, activoBankPdf, PDF(), { section: poupeKey })
    expect(wrong.warnings.join(' ')).toMatch(/outra conta/)

    const rows = await listMovements(hh, { limit: 100 })
    expect(rows).toHaveLength(9)
    expect(rows.filter((r) => r.type === 'transfer')).toHaveLength(4)
    const stored = await getDb().execute(`SELECT external_ref_hash FROM ledger_accounts WHERE external_ref_hash IS NOT NULL`)
    expect(stored.rows).toHaveLength(2)
    expect(JSON.stringify(stored.rows)).not.toContain('1234567')
  })
})
