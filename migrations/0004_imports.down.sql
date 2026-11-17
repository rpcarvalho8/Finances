DROP INDEX IF EXISTS idx_ledger_movements_import_batch;
ALTER TABLE ledger_movements DROP COLUMN import_batch_id;
DROP TABLE IF EXISTS import_batches;
