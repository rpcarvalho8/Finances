/**
 * Non-destructive database bootstrap.
 *
 * Creates the canonical tables from `lib/db.ts` (`CREATE TABLE IF NOT EXISTS`)
 * and never deletes or overwrites rows. Safe to run against a database that
 * already holds data. Use `npm run db:seed` only for demo data: it DELETES rows.
 */
import { closeDb, initDB } from '../lib/db'

initDB()
  .then(() => {
    closeDb()
  })
  .catch((err) => {
    console.error('db:init failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
