import { createClient } from '@libsql/client'

export const db = createClient({
  url: process.env.DATABASE_URL || 'file:./data/finance.db',
})

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
  if (rows[0].count === 0) {
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('lumeu', 'LUMEU', 'lumeu')`);
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('condoflow', 'Condomínio', 'condoflow')`);
    await db.execute(`INSERT INTO businesses (id, name, slug) VALUES ('trade', 'Trade', 'trade')`);
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_txn_owner ON transactions(owner)`)
  console.log('✅ DB inicializada')
}
