import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic data only.

let tmpDir: string
let backupDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-migrate-'))
  backupDir = path.join(tmpDir, 'backups')
  process.env.DATABASE_URL = `file:${path.join(tmpDir, 'finance.db')}`
})

afterEach(async () => {
  const { closeDb } = await import('@/lib/db')
  closeDb()
  delete process.env.DATABASE_URL
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

async function tables(): Promise<string[]> {
  const { db } = await import('@/lib/db')
  const { rows } = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  return rows.map((r) => String(r.name))
}

function writeMigrations(files: Record<string, string>): string {
  const dir = path.join(tmpDir, 'migrations')
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql)
  return dir
}

describe('migrations in the repo', () => {
  it('load in order, baseline irreversible, 0002 reversible', async () => {
    const { loadMigrations } = await import('@/lib/migrate')
    const ms = loadMigrations()
    expect(ms.map((m) => m.version)).toEqual(ms.map((_, i) => i + 1))
    expect(ms[0].name).toBe('baseline')
    expect(ms[0].down).toBeNull()
    expect(ms[1].name).toBe('households_sessions')
    expect(ms[1].down).not.toBeNull()
    expect(ms[2].name).toBe('ledger')
    expect(ms[2].down).not.toBeNull()
  })

  it('create households, members and sessions on a fresh database without a backup', async () => {
    const { migrate } = await import('@/lib/migrate')
    const r = await migrate({ backupDir })
    expect(r.applied).toEqual([1, 2, 3])
    expect(r.backup).toBeNull()
    const t = await tables()
    for (const name of ['households', 'household_members', 'sessions', 'users', 'transactions', 'schema_migrations']) {
      expect(t).toContain(name)
    }
    expect(await migrate({ backupDir })).toEqual({ applied: [], backup: null })
  })

  it('adopt a database created by the old initDB(), keep its rows and back it up first', async () => {
    const { db } = await import('@/lib/db')
    const { loadMigrations, migrate } = await import('@/lib/migrate')
    await db.execute(loadMigrations()[0].up.split(';')[0]) // old users table
    await db.execute(
      `CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL DEFAULT 1, date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category_id INTEGER, subcategory TEXT, type TEXT NOT NULL, owner TEXT NOT NULL, notes TEXT, import_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    )
    await db.execute(`INSERT INTO transactions (date, description, amount, type, owner) VALUES ('2026-01-01','SYNTHETIC',-1.5,'expense','x')`)

    const r = await migrate({ backupDir })
    expect(r.applied).toEqual([1, 2, 3])
    expect(r.backup && fs.existsSync(r.backup)).toBe(true)
    const { rows } = await db.execute(`SELECT COUNT(*) AS n FROM transactions`)
    expect(Number(rows[0].n)).toBe(1)
  })

  it('rollback reverts 0003 then 0002 with backups and refuses the baseline', async () => {
    const { migrate, rollback } = await import('@/lib/migrate')
    await migrate({ backupDir })
    const r3 = await rollback({ backupDir })
    expect(r3.reverted).toBe(3)
    expect(r3.backup && fs.existsSync(r3.backup)).toBe(true)
    for (const t of ['ledger_accounts', 'ledger_movements', 'ledger_categories', 'household_goals', 'household_settings']) {
      expect(await tables()).not.toContain(t)
    }
    expect(await tables()).toContain('sessions')
    const r = await rollback({ backupDir })
    expect(r.reverted).toBe(2)
    expect(r.backup && fs.existsSync(r.backup)).toBe(true)
    expect(await tables()).not.toContain('sessions')
    expect(await tables()).toContain('transactions')
    await expect(rollback({ backupDir })).rejects.toThrow(/irreversível/)
    expect((await migrate({ backupDir })).applied).toEqual([2, 3])
  })
})

describe('migration runner safety', () => {
  it('a failing migration leaves nothing half-applied', async () => {
    const { migrate, appliedVersions } = await import('@/lib/migrate')
    const dir = writeMigrations({
      '0001_ok.up.sql': 'CREATE TABLE a (id INTEGER);',
      '0002_bad.up.sql': 'CREATE TABLE b (id INTEGER); INSERT INTO missing_table VALUES (1);',
    })
    await expect(migrate({ dir, backupDir })).rejects.toThrow(/0*2 \(bad\) falhou/)
    expect(await tables()).toContain('a')
    expect(await tables()).not.toContain('b')
    expect((await appliedVersions()).map((v) => v.version)).toEqual([1])
  })

  it('detects a migration edited after it was applied', async () => {
    const { migrate } = await import('@/lib/migrate')
    const dir = writeMigrations({ '0001_x.up.sql': 'CREATE TABLE a (id INTEGER);' })
    await migrate({ dir, backupDir })
    fs.writeFileSync(path.join(dir, '0001_x.up.sql'), 'CREATE TABLE a (id INTEGER, extra TEXT);')
    await expect(migrate({ dir, backupDir })).rejects.toThrow(/alterada depois de aplicada/)
  })

  it('rejects gaps and bad file names', async () => {
    const { loadMigrations } = await import('@/lib/migrate')
    expect(() => loadMigrations(writeMigrations({ '0002_y.up.sql': 'SELECT 1;' }))).toThrow(/contíguas/)
    fs.rmSync(path.join(tmpDir, 'migrations'), { recursive: true })
    expect(() => loadMigrations(writeMigrations({ 'oops.sql': 'SELECT 1;' }))).toThrow(/inválido/)
  })
})
