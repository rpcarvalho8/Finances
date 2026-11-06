/**
 * Local database backup (replaces the old GET /api/backup download).
 *
 * Writes a consistent copy with SQLite `VACUUM INTO` to `backups/` (ignored by
 * git). Run on the machine that holds the database: `npm run db:backup`.
 */
import fs from 'fs'
import path from 'path'
import { closeDb, db } from '../lib/db'

export function backupFileName(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  return `finance-${stamp}.db`
}

export async function backupDb(dir = 'backups', now = new Date()): Promise<string> {
  fs.mkdirSync(dir, { recursive: true })
  const target = path.resolve(dir, backupFileName(now))
  if (fs.existsSync(target)) throw new Error(`Backup já existe: ${target}`)
  await db.execute({ sql: 'VACUUM INTO ?', args: [target] })
  return target
}

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
