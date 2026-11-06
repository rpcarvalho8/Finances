import { createClient, type Client } from '@libsql/client'
import fs from 'fs'
import path from 'path'

export const DEFAULT_DATABASE_URL = 'file:./data/finance.db'

let client: Client | null = null

/** Directory that must exist before libsql can open a `file:` URL. */
export function dbFileDir(url: string): string | null {
  if (!url.startsWith('file:')) return null
  const filePath = url.slice('file:'.length)
  if (!filePath || filePath === ':memory:') return null
  return path.dirname(path.resolve(filePath))
}

/**
 * Lazily creates the libsql client on first use, so importing this module
 * (e.g. during `next build` "collecting page data") never opens the database.
 */
export function getDb(): Client {
  if (client) return client
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL
  const dir = dbFileDir(url)
  if (dir) fs.mkdirSync(dir, { recursive: true })
  client = createClient({ url })
  return client
}

/** Closes and forgets the client (used by tests and scripts). */
export function closeDb(): void {
  client?.close()
  client = null
}

/** Same call shape as the libsql client, but connects only when a query runs. */
export const db: Pick<Client, 'execute'> = {
  execute: ((stmt: Parameters<Client['execute']>[0]) => getDb().execute(stmt)) as Client['execute'],
}

export async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'member', created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner TEXT NOT NULL, bank TEXT NOT NULL, type TEXT DEFAULT 'checking', balance REAL DEFAULT 0, currency TEXT DEFAULT 'EUR', color TEXT DEFAULT '#7eb8f9', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '📦', color TEXT DEFAULT '#888', type TEXT DEFAULT 'expense', owner TEXT DEFAULT 'all', budget_pct REAL DEFAULT 0, is_business INTEGER DEFAULT 0)`)
  await db.execute(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL DEFAULT 1, date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category_id INTEGER, subcategory TEXT, type TEXT NOT NULL, owner TEXT NOT NULL, notes TEXT, import_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS investments (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, symbol TEXT, quantity REAL DEFAULT 0, avg_price REAL DEFAULT 0, current_price REAL DEFAULT 0, invested REAL DEFAULT 0, current_value REAL DEFAULT 0, currency TEXT DEFAULT 'EUR', owner TEXT DEFAULT 'rui', last_updated TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '🎯', target REAL NOT NULL, saved REAL DEFAULT 0, deadline TEXT, owner TEXT DEFAULT 'rui', color TEXT DEFAULT '#c8f97e', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS api_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT UNIQUE NOT NULL, api_key TEXT, api_secret TEXT, extra TEXT, active INTEGER DEFAULT 1, last_sync TEXT, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS lumeu_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id INTEGER, date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category TEXT DEFAULT 'infra', vendor TEXT, notes TEXT, receipt_url TEXT, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE)`)
  // Insert initial businesses only if the table is empty
  const { rows } = await db.execute(`SELECT COUNT(*) as count FROM businesses`);
  if (Number(rows[0].count) === 0) {
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('lumeu', 'LUMEU', 'lumeu')`);
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('condoflow', 'Condomínio', 'condoflow')`);
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('trade', 'Trade', 'trade')`);
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_txn_owner ON transactions(owner)`)
  console.log('✅ DB inicializada')
}
