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
