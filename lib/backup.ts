import fs from 'fs'
import path from 'path'
import { db } from './db'

export function backupFileName(now: Date, label?: string): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  return `finance-${stamp}${label ? `-${label.replace(/[^a-z0-9-]/gi, '')}` : ''}.db`
}

/** Consistent copy of the live database with SQLite `VACUUM INTO`. */
export async function backupDb(dir = 'backups', now = new Date(), label?: string): Promise<string> {
  fs.mkdirSync(dir, { recursive: true })
  const target = path.resolve(dir, backupFileName(now, label))
  if (fs.existsSync(target)) throw new Error(`Backup já existe: ${target}`)
  await db.execute({ sql: 'VACUUM INTO ?', args: [target] })
  return target
}
