import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic data only. Never put real household data in tests.

let tmpDir: string
let dbPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-test-'))
  dbPath = path.join(tmpDir, 'nested', 'finance.db')
  process.env.DATABASE_URL = `file:${dbPath}`
})

afterEach(async () => {
  const { closeDb } = await import('@/lib/db')
  closeDb()
  delete process.env.DATABASE_URL
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('lib/db', () => {
  it('does not open or create the database when the module is imported', async () => {
    await import('@/lib/db')
    expect(fs.existsSync(dbPath)).toBe(false)
  })

  it('dbFileDir resolves the parent directory of file: URLs only', async () => {
    const { dbFileDir } = await import('@/lib/db')
    expect(dbFileDir('file:./data/finance.db')).toBe(path.resolve('data'))
    expect(dbFileDir('file::memory:')).toBeNull()
    expect(dbFileDir('libsql://example.turso.io')).toBeNull()
  })

  it('initDB creates the canonical tables, including missing parent directories', async () => {
    const { db } = await import('@/lib/db')
    const { initDB } = await import('@/lib/migrate')
    await initDB()
    expect(fs.existsSync(dbPath)).toBe(true)
    const { rows } = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    const names = rows.map((r) => r.name)
    for (const t of ['accounts', 'api_keys', 'businesses', 'categories', 'goals', 'investments', 'lumeu_expenses', 'transactions', 'users']) {
      expect(names).toContain(t)
    }
  })

  it('initDB is non-destructive when run again on a database with data', async () => {
    const { db } = await import('@/lib/db')
    const { initDB } = await import('@/lib/migrate')
    await initDB()
    await db.execute({
      sql: `INSERT INTO transactions (date, description, amount, type, owner) VALUES (?, ?, ?, ?, ?)`,
      args: ['2026-01-15', 'SYNTHETIC GROCERY', -12.34, 'expense', 'test-owner'],
    })
    await initDB()
    const { rows } = await db.execute(`SELECT COUNT(*) AS n FROM transactions`)
    expect(Number(rows[0].n)).toBe(1)
    const biz = await db.execute(`SELECT COUNT(*) AS n FROM businesses`)
    expect(Number(biz.rows[0].n)).toBe(3)
  })
})
