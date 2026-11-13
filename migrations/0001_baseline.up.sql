-- Baseline: the schema that lib/db.ts initDB() created before migrations existed.
-- IF NOT EXISTS so databases created by the old initDB() adopt this version unchanged.
-- Irreversible on purpose (no .down.sql): rolling it back would drop every table.
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'member', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner TEXT NOT NULL, bank TEXT NOT NULL, type TEXT DEFAULT 'checking', balance REAL DEFAULT 0, currency TEXT DEFAULT 'EUR', color TEXT DEFAULT '#7eb8f9', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '📦', color TEXT DEFAULT '#888', type TEXT DEFAULT 'expense', owner TEXT DEFAULT 'all', budget_pct REAL DEFAULT 0, is_business INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL DEFAULT 1, date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category_id INTEGER, subcategory TEXT, type TEXT NOT NULL, owner TEXT NOT NULL, notes TEXT, import_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS investments (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, symbol TEXT, quantity REAL DEFAULT 0, avg_price REAL DEFAULT 0, current_price REAL DEFAULT 0, invested REAL DEFAULT 0, current_value REAL DEFAULT 0, currency TEXT DEFAULT 'EUR', owner TEXT DEFAULT 'rui', last_updated TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '🎯', target REAL NOT NULL, saved REAL DEFAULT 0, deadline TEXT, owner TEXT DEFAULT 'rui', color TEXT DEFAULT '#c8f97e', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS api_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT UNIQUE NOT NULL, api_key TEXT, api_secret TEXT, extra TEXT, active INTEGER DEFAULT 1, last_sync TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS lumeu_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id INTEGER, date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category TEXT DEFAULT 'infra', vendor TEXT, notes TEXT, receipt_url TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE);
-- Default businesses only on an empty table (same behaviour as the old initDB()).
INSERT INTO businesses (id, name, slug)
  SELECT column1, column2, column3 FROM (VALUES ('lumeu', 'LUMEU', 'lumeu'), ('condoflow', 'Condomínio', 'condoflow'), ('trade', 'Trade', 'trade'))
  WHERE NOT EXISTS (SELECT 1 FROM businesses);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_txn_owner ON transactions(owner);
