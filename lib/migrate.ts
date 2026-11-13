/**
 * Versioned SQL migrations (DB-D02: plain `migrations/*.sql`, no ORM).
 *
 * - `NNNN_name.up.sql` applies a version; `NNNN_name.down.sql` reverts it.
 *   A version without a down file is irreversible (e.g. the baseline).
 * - Each version runs inside one write transaction together with its row in
 *   `schema_migrations`, so a failing migration leaves nothing half-applied.
 * - Before changing an existing database, a backup is written to `backups/`
 *   (unless `backup: false`, used only by tests on throwaway databases).
 * - A checksum per version detects edits to migrations already applied.
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { backupDb } from './backup'
import { getDb } from './db'

export type Migration = {
  version: number
  name: string
  up: string
  down: string | null
  checksum: string
}

export type MigrateOptions = {
  dir?: string
  backup?: boolean
  backupDir?: string
  log?: (msg: string) => void
}

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/

export const DEFAULT_MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations')

export function loadMigrations(dir = DEFAULT_MIGRATIONS_DIR): Migration[] {
  const byVersion = new Map<number, { name: string; up?: string; down?: string }>()
  for (const file of fs.readdirSync(dir).sort()) {
    const m = FILE_RE.exec(file)
    if (!m) {
      if (file.endsWith('.sql')) throw new Error(`Nome de migração inválido: ${file}`)
      continue
    }
    const version = Number(m[1])
    const entry = byVersion.get(version) ?? { name: m[2] }
    if (entry.name !== m[2]) throw new Error(`Versão ${m[1]} tem nomes diferentes: ${entry.name} / ${m[2]}`)
    entry[m[3] as 'up' | 'down'] = fs.readFileSync(path.join(dir, file), 'utf8')
    byVersion.set(version, entry)
  }
  const versions = Array.from(byVersion.keys()).sort((a, b) => a - b)
  versions.forEach((v, i) => {
    if (v !== i + 1) throw new Error(`Migrações têm de ser contíguas a partir de 0001 (falta ${String(i + 1).padStart(4, '0')})`)
  })
  return versions.map((version) => {
    const e = byVersion.get(version)!
    if (!e.up) throw new Error(`Falta o ficheiro .up.sql da versão ${version}`)
    return {
      version,
      name: e.name,
      up: e.up,
      down: e.down ?? null,
      checksum: crypto.createHash('sha256').update(e.up).digest('hex'),
    }
  })
}

async function ensureTable(): Promise<void> {
  await getDb().execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

export async function appliedVersions(): Promise<Array<{ version: number; name: string; checksum: string }>> {
  await ensureTable()
  const { rows } = await getDb().execute(`SELECT version, name, checksum FROM schema_migrations ORDER BY version`)
  return rows.map((r) => ({ version: Number(r.version), name: String(r.name), checksum: String(r.checksum) }))
}

async function hasUserTables(): Promise<boolean> {
  const { rows } = await getDb().execute(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'`,
  )
  return Number(rows[0].n) > 0
}

function verifyChecksums(all: Migration[], applied: Array<{ version: number; checksum: string }>): void {
  for (const a of applied) {
    const m = all.find((x) => x.version === a.version)
    if (!m) throw new Error(`A BD tem a versão ${a.version}, que não existe em migrations/ (código mais antigo que a BD?)`)
    if (m.checksum !== a.checksum) throw new Error(`A migração ${a.version} (${m.name}) foi alterada depois de aplicada`)
  }
}

export async function migrate(opts: MigrateOptions = {}): Promise<{ applied: number[]; backup: string | null }> {
  const log = opts.log ?? (() => {})
  const all = loadMigrations(opts.dir)
  const applied = await appliedVersions()
  verifyChecksums(all, applied)
  const done = new Set(applied.map((a) => a.version))
  const pending = all.filter((m) => !done.has(m.version))
  if (pending.length === 0) return { applied: [], backup: null }

  let backup: string | null = null
  if (opts.backup !== false && (await hasUserTables())) {
    backup = await backupDb(opts.backupDir, new Date(), `pre-migrate-${pending[0].version}`)
    log(`Backup antes de migrar: ${backup}`)
  }

  const out: number[] = []
  for (const m of pending) {
    const tx = await getDb().transaction('write')
    try {
      await tx.executeMultiple(m.up)
      await tx.execute({
        sql: `INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)`,
        args: [m.version, m.name, m.checksum],
      })
      await tx.commit()
    } catch (err) {
      await tx.rollback().catch(() => {})
      throw new Error(`Migração ${m.version} (${m.name}) falhou: ${err instanceof Error ? err.message : err}`)
    } finally {
      tx.close()
    }
    log(`Aplicada ${String(m.version).padStart(4, '0')}_${m.name}`)
    out.push(m.version)
  }
  return { applied: out, backup }
}

/** Reverts the most recent version. Refuses irreversible versions. Always backs up first unless disabled. */
export async function rollback(opts: MigrateOptions = {}): Promise<{ reverted: number; backup: string | null }> {
  const log = opts.log ?? (() => {})
  const all = loadMigrations(opts.dir)
  const applied = await appliedVersions()
  verifyChecksums(all, applied)
  const last = applied[applied.length - 1]
  if (!last) throw new Error('Não há migrações aplicadas')
  const m = all.find((x) => x.version === last.version)!
  if (!m.down) throw new Error(`A migração ${m.version} (${m.name}) é irreversível`)

  let backup: string | null = null
  if (opts.backup !== false) {
    backup = await backupDb(opts.backupDir, new Date(), `pre-rollback-${m.version}`)
    log(`Backup antes de reverter: ${backup}`)
  }
  const tx = await getDb().transaction('write')
  try {
    await tx.executeMultiple(m.down)
    await tx.execute({ sql: `DELETE FROM schema_migrations WHERE version = ?`, args: [m.version] })
    await tx.commit()
  } catch (err) {
    await tx.rollback().catch(() => {})
    throw new Error(`Reversão da migração ${m.version} falhou: ${err instanceof Error ? err.message : err}`)
  } finally {
    tx.close()
  }
  log(`Revertida ${String(m.version).padStart(4, '0')}_${m.name}`)
  return { reverted: m.version, backup }
}

/** Non-destructive setup used by `db:init` and the demo seed. */
export async function initDB(opts: MigrateOptions = {}): Promise<void> {
  await migrate(opts)
}
