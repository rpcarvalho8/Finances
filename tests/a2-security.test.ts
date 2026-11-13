import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic data only.

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-a2-'))
  process.env.DATABASE_URL = `file:${path.join(tmpDir, 'finance.db')}`
})

afterEach(async () => {
  const { closeDb } = await import('@/lib/db')
  closeDb()
  delete process.env.DATABASE_URL
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('disabled endpoints return 410 and never touch the database', () => {
  const cases: Array<[string, string]> = [
    ['@/app/api/ai-advisor/route', 'POST'],
    ['@/app/api/backup/route', 'GET'],
    ['@/app/api/settings/api-keys/route', 'GET'],
    ['@/app/api/settings/api-keys/route', 'POST'],
    ['@/app/api/sync/bank/init/route', 'POST'],
    ['@/app/api/sync/bank/callback/route', 'GET'],
    ['@/app/api/investments/sync/route', 'GET'],
  ]
  for (const [mod, method] of cases) {
    it(`${method} ${mod.replace('@/app', '').replace('/route', '')}`, async () => {
      const m = (await import(mod)) as Record<string, () => Response>
      const res = m[method]()
      expect(res.status).toBe(410)
      const body = await res.json()
      expect(body.code).toBe('FEATURE_DISABLED')
      expect(fs.existsSync(path.join(tmpDir, 'finance.db'))).toBe(false)
    })
  }
})

describe('parseBudgets', () => {
  it('accepts numeric strings and ignores empty or invalid values', async () => {
    const { parseBudgets } = await import('@/lib/useBudgets')
    expect(parseBudgets({ rui_income: '1000.50', ana_income: '', joint_income: 'abc' })).toEqual({
      rui_income: 1000.5,
      ana_income: 0,
      joint_income: 0,
    })
    expect(parseBudgets(null)).toEqual({ rui_income: 0, ana_income: 0, joint_income: 0 })
  })
})

describe('db:backup', () => {
  it('writes a consistent copy that contains the data', async () => {
    const { db } = await import('@/lib/db')
    const { initDB } = await import('@/lib/migrate')
    const { backupDb } = await import('@/scripts/backup-db')
    await initDB()
    await db.execute({
      sql: `INSERT INTO transactions (date, description, amount, type, owner) VALUES (?,?,?,?,?)`,
      args: ['2026-01-01', 'SYNTHETIC', -1.23, 'expense', 'test'],
    })
    const file = await backupDb(path.join(tmpDir, 'backups'), new Date('2026-11-06T10:00:00Z'))
    expect(path.basename(file)).toBe('finance-2026-11-06_10-00-00.db')
    const { createClient } = await import('@libsql/client')
    const copy = createClient({ url: `file:${file}` })
    const { rows } = await copy.execute(`SELECT COUNT(*) AS n FROM transactions`)
    expect(Number(rows[0].n)).toBe(1)
    copy.close()
  })
})

describe('db:purge-secrets', () => {
  it('clears stored keys and bank tokens but keeps budgets and transactions', async () => {
    const { db } = await import('@/lib/db')
    const { initDB } = await import('@/lib/migrate')
    const { purgeSecrets } = await import('@/scripts/purge-secrets')
    await initDB()
    await db.execute(`INSERT INTO api_keys (platform, api_key, api_secret) VALUES ('broker-x', 'k', 's')`)
    await db.execute(`INSERT INTO api_keys (platform, extra) VALUES ('__budgets__', '{"rui_income":"1"}')`)
    await db.execute(`CREATE TABLE bank_accounts (id TEXT PRIMARY KEY, access_token TEXT)`)
    await db.execute(`INSERT INTO bank_accounts VALUES ('acc-1', 'token')`)
    await db.execute(`INSERT INTO transactions (date, description, amount, type, owner) VALUES ('2026-01-01','SYNTHETIC',-1,'expense','t')`)

    expect(await purgeSecrets()).toEqual({ apiKeys: 1, bankTokens: 1 })

    const keys = await db.execute(`SELECT platform, api_key, api_secret, extra FROM api_keys ORDER BY platform`)
    expect(keys.rows.map((r) => [r.platform, r.api_key, r.api_secret])).toEqual([
      ['__budgets__', null, null],
      ['broker-x', null, null],
    ])
    expect(keys.rows[0].extra).toBe('{"rui_income":"1"}')
    const tok = await db.execute(`SELECT access_token FROM bank_accounts`)
    expect(tok.rows[0].access_token).toBeNull()
    const tx = await db.execute(`SELECT COUNT(*) AS n FROM transactions`)
    expect(Number(tx.rows[0].n)).toBe(1)
  })
})

describe('synthetic seed', () => {
  it('only uses invented descriptions and categories that exist', async () => {
    const { CATEGORIES, syntheticTransactions } = await import('@/scripts/seed')
    const cats = new Set(CATEGORIES.map((c) => c[0]))
    const txns = syntheticTransactions()
    expect(txns.length).toBeGreaterThan(0)
    for (const [date, description, amount, , owner, category] of txns) {
      expect(date).toMatch(/^2026-\d{2}-\d{2}$/)
      expect(description).toMatch(/EXEMPLO|CONTRIBUICAO MENSAL/)
      expect(Number.isFinite(amount)).toBe(true)
      expect(['rui', 'ana', 'conjunta']).toContain(owner)
      expect(cats.has(category)).toBe(true)
    }
  })
})
