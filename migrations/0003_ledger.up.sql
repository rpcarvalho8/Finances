-- A4b: typed accounts and movements, money as integer cents + currency, everything scoped
-- by household (agregado) and owned by user IDs. The legacy tables (accounts, transactions,
-- categories, goals) are left untouched and unused (DB-D01: no real data to migrate); they
-- are dropped later in a cleanup migration with backup.

-- Short label used by the person views (/rui, /ana). Derived from the name; unique.
ALTER TABLE users ADD COLUMN slug TEXT;
UPDATE users SET slug = lower(trim(name)) WHERE slug IS NULL;
CREATE UNIQUE INDEX idx_users_slug ON users(slug);

CREATE TABLE ledger_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#888888',
  kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income', 'transfer', 'investment', 'savings')),
  budget_pct INTEGER NOT NULL DEFAULT 0 CHECK (budget_pct BETWEEN 0 AND 100),
  UNIQUE (household_id, name)
);

CREATE TABLE ledger_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT, -- NULL = conta conjunta
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'manual',
  kind TEXT NOT NULL CHECK (kind IN ('checking', 'savings', 'term_deposit', 'ppr_fund', 'broker', 'trading', 'crypto', 'meal_card', 'insurance', 'liability')),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  external_ref_hash TEXT, -- hash of the IBAN / account number, never the number itself
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ledger_accounts_household ON ledger_accounts(household_id);
CREATE UNIQUE INDEX idx_ledger_accounts_default ON ledger_accounts(household_id, ifnull(owner_user_id, 0)) WHERE is_default = 1;

CREATE TABLE ledger_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  booked_on TEXT NOT NULL CHECK (booked_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  value_on TEXT CHECK (value_on IS NULL OR value_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  amount_cents INTEGER NOT NULL CHECK (typeof(amount_cents) = 'integer'),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'investment', 'savings', 'refund', 'adjustment', 'in_kind_income', 'insurance_movement')),
  category_id INTEGER REFERENCES ledger_categories(id) ON DELETE SET NULL,
  transfer_group TEXT,
  dedupe_key TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'seed')),
  notes TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, dedupe_key)
);
CREATE INDEX idx_ledger_movements_household_date ON ledger_movements(household_id, booked_on);
CREATE INDEX idx_ledger_movements_account ON ledger_movements(account_id);

-- Defence in depth: a movement can only point at an account (and category) of its own household.
CREATE TRIGGER ledger_movements_same_household_ins BEFORE INSERT ON ledger_movements
WHEN (SELECT household_id FROM ledger_accounts WHERE id = NEW.account_id) IS NOT NEW.household_id
  OR (NEW.category_id IS NOT NULL AND (SELECT household_id FROM ledger_categories WHERE id = NEW.category_id) IS NOT NEW.household_id)
BEGIN SELECT RAISE(ABORT, 'movement household mismatch'); END;
CREATE TRIGGER ledger_movements_same_household_upd BEFORE UPDATE OF household_id, account_id, category_id ON ledger_movements
WHEN (SELECT household_id FROM ledger_accounts WHERE id = NEW.account_id) IS NOT NEW.household_id
  OR (NEW.category_id IS NOT NULL AND (SELECT household_id FROM ledger_categories WHERE id = NEW.category_id) IS NOT NEW.household_id)
BEGIN SELECT RAISE(ABORT, 'movement household mismatch'); END;

CREATE TABLE household_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL = objetivo da família
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  color TEXT NOT NULL DEFAULT '#c8f97e',
  target_cents INTEGER NOT NULL CHECK (typeof(target_cents) = 'integer' AND target_cents > 0),
  saved_cents INTEGER NOT NULL DEFAULT 0 CHECK (typeof(saved_cents) = 'integer' AND saved_cents >= 0),
  deadline TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_household_goals_household ON household_goals(household_id);

CREATE TABLE household_settings (
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (household_id, key)
);

-- Manual investment lines stay in the legacy table until B4 (INV-001) replaces them,
-- but are scoped by household from now on. Rows without a household are invisible.
ALTER TABLE investments ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE CASCADE;
CREATE INDEX idx_investments_household ON investments(household_id);
