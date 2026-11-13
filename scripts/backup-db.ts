/**
 * Local database backup (replaces the old GET /api/backup download).
 *
 * Writes a consistent copy with SQLite `VACUUM INTO` to `backups/` (ignored by
 * git). Run on the machine that holds the database: `npm run db:backup`.
 */
import { backupDb, backupFileName } from '../lib/backup'
import { closeDb } from '../lib/db'

export { backupDb, backupFileName }

if (require.main === module) {
  backupDb()
    .then((file) => {
      console.log(`✅ Backup criado: ${file}`)
      closeDb()
    })
    .catch((err) => {
      console.error('db:backup falhou:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
