-- B1a: one row per committed import (file hash, counts, report). The file itself is never stored.
CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL,
  file_sha256 TEXT NOT NULL CHECK (length(file_sha256) = 64),
  file_name TEXT,
  period_from TEXT,
  period_to TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_error INTEGER NOT NULL DEFAULT 0,
  report_json TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_import_batches_account_file ON import_batches(account_id, file_sha256);
CREATE INDEX idx_import_batches_household ON import_batches(household_id);

-- Which import created a movement (no FK so the column can be dropped on rollback).
ALTER TABLE ledger_movements ADD COLUMN import_batch_id INTEGER;
CREATE INDEX idx_ledger_movements_import_batch ON ledger_movements(import_batch_id);
