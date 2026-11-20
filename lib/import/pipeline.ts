/**
 * Shared import pipeline (B1a): parse → dedupe keys → preview → commit.
 * Every bank format and, later, every live connector (phase D) feeds this same path.
 *
 * - Nothing is written on preview. Commit re-parses the uploaded file, so the
 *   client cannot inject rows; it only confirms the file hash it previewed.
 * - Dedupe key = hash of (date, value date, cents, normalised description, n-th
 *   occurrence of that tuple in the file). Re-importing the same or an
 *   overlapping file inserts nothing twice; UNIQUE(account_id, dedupe_key) is the
 *   last line of defence.
 * - The file itself is never stored; only its SHA-256, name and counts.
 */
import crypto from 'crypto'
import { getDb } from '../db'
import { LedgerError } from '../ledger'
import type { ImportSource, ParsedRow, RowError, StatementSection } from './types'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 20_000

export type PreviewRow = {
  line: number
  date: string
  description: string
  amount_cents: number
  status: 'new' | 'duplicate'
}

export type Preview = {
  source: string
  account: { id: number; name: string }
  fileSha256: string
  alreadyImported: boolean
  period: { from: string; to: string } | null
  counts: { total: number; new: number; duplicate: number; error: number }
  rows: PreviewRow[]
  errors: RowError[]
  warnings: string[]
  /** Accounts inside a multi-account statement, and the one shown. */
  sections: StatementSection[] | null
  section: string | null
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function normDescription(s: string): string {
  return s.normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim()
}

export function dedupeKeys(rows: ParsedRow[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = `${r.bookedOn}|${r.valueOn ?? ''}|${r.amountCents}|${normDescription(r.description)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return crypto.createHash('sha256').update(`${base}|${n}`).digest('hex').slice(0, 40)
  })
}

/**
 * Warns when the running balance does not chain: every row's (balance − amount)
 * should be the balance of some other row, except the oldest one.
 */
export function balanceWarnings(rows: ParsedRow[]): string[] {
  const withBal = rows.filter((r) => r.balanceCents !== null)
  if (withBal.length < 2) return []
  const balances = new Set(withBal.map((r) => r.balanceCents as number))
  const starts = withBal.filter((r) => !balances.has((r.balanceCents as number) - r.amountCents))
  return starts.length > 1
    ? [`Os saldos não encadeiam em ${starts.length - 1} ponto(s): pode faltar algum movimento no ficheiro. A importação continua.`]
    : []
}

async function accountOf(householdId: number, accountId: number): Promise<{ id: number; name: string; ref: string | null }> {
  const { rows } = await getDb().execute({
    sql: `SELECT id, name, external_ref_hash FROM ledger_accounts WHERE id = ? AND household_id = ? AND archived_at IS NULL`,
    args: [accountId, householdId],
  })
  if (!rows[0]) throw new LedgerError('Conta não encontrada', 404)
  return { id: Number(rows[0].id), name: String(rows[0].name), ref: rows[0].external_ref_hash === null ? null : String(rows[0].external_ref_hash) }
}

export type ImportOptions = { section?: string | null }

type Analysed = { preview: Preview; rows: ParsedRow[]; keys: string[]; isNew: boolean[]; accountRef: string | null; accountHasRef: boolean }

async function analyse(householdId: number, accountId: number, source: ImportSource, bytes: Uint8Array, opts: ImportOptions = {}): Promise<Analysed> {
  if (bytes.byteLength === 0) throw new LedgerError('Ficheiro vazio', 400)
  if (bytes.byteLength > MAX_FILE_BYTES) throw new LedgerError('Ficheiro demasiado grande (máx. 5 MB)', 413)
  const accountFull = await accountOf(householdId, accountId)
  const account = { id: accountFull.id, name: accountFull.name }
  const parsed = await source.parse(bytes, { section: opts.section ?? null })
  const refWarning =
    parsed.accountRef && accountFull.ref && parsed.accountRef !== accountFull.ref
      ? ['Este extrato parece ser de outra conta: o número não coincide com o das importações anteriores para esta conta.']
      : []
  if (parsed.rows.length > MAX_ROWS) throw new LedgerError(`Demasiadas linhas (máx. ${MAX_ROWS})`, 413)

  // Oldest first, stable on the file line: file order is not trusted (ABANCA mixes it).
  const rows = [...parsed.rows].sort((a, b) => (a.bookedOn < b.bookedOn ? -1 : a.bookedOn > b.bookedOn ? 1 : a.line - b.line))
  const keys = dedupeKeys(rows)
  const existing = new Set<string>()
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500)
    const r = await getDb().execute({
      sql: `SELECT dedupe_key FROM ledger_movements WHERE account_id = ? AND dedupe_key IN (${chunk.map(() => '?').join(',')})`,
      args: [accountId, ...chunk],
    })
    for (const row of r.rows) existing.add(String(row.dedupe_key))
  }
  const isNew = keys.map((k) => !existing.has(k))
  const fileSha256 = sha256Hex(bytes)
  const prev = await getDb().execute({
    sql: `SELECT 1 FROM import_batches WHERE account_id = ? AND file_sha256 = ? LIMIT 1`,
    args: [accountId, fileSha256],
  })
  const nNew = isNew.filter(Boolean).length
  const preview: Preview = {
    source: source.id,
    account,
    fileSha256,
    alreadyImported: prev.rows.length > 0,
    period: rows.length ? { from: rows[0].bookedOn, to: rows[rows.length - 1].bookedOn } : null,
    counts: { total: rows.length + parsed.errors.length, new: nNew, duplicate: rows.length - nNew, error: parsed.errors.length },
    rows: rows.map((r, i) => ({ line: r.line, date: r.bookedOn, description: r.description, amount_cents: r.amountCents, status: isNew[i] ? 'new' : 'duplicate' })),
    errors: parsed.errors,
    warnings: [...refWarning, ...parsed.warnings, ...balanceWarnings(rows)],
    sections: parsed.sections ?? null,
    section: parsed.section ?? null,
  }
  return { preview, rows, keys, isNew, accountRef: parsed.accountRef ?? null, accountHasRef: accountFull.ref !== null }
}

export async function previewImport(householdId: number, accountId: number, source: ImportSource, bytes: Uint8Array, opts: ImportOptions = {}): Promise<Preview> {
  return (await analyse(householdId, accountId, source, bytes, opts)).preview
}

export type CommitResult = { batchId: number; inserted: number; duplicate: number; error: number }

export async function commitImport(
  householdId: number,
  userId: number,
  accountId: number,
  source: ImportSource,
  bytes: Uint8Array,
  opts: { expectedSha256: string; fileName?: string | null; section?: string | null },
): Promise<CommitResult> {
  const { preview, rows, keys, isNew, accountRef, accountHasRef } = await analyse(householdId, accountId, source, bytes, { section: opts.section })
  if (preview.fileSha256 !== opts.expectedSha256) throw new LedgerError('O ficheiro mudou desde a pré-visualização. Volta a pré-visualizar.', 409)
  if (rows.length === 0) throw new LedgerError('Não há movimentos válidos para importar', 400)

  const tx = await getDb().transaction('write')
  try {
    const b = await tx.execute({
      sql: `INSERT INTO import_batches (household_id, account_id, source, file_sha256, file_name, period_from, period_to, rows_total, rows_error, report_json, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        householdId,
        accountId,
        source.id,
        preview.fileSha256,
        opts.fileName ? opts.fileName.slice(0, 200) : null,
        preview.period?.from ?? null,
        preview.period?.to ?? null,
        preview.counts.total,
        preview.counts.error,
        JSON.stringify({ errors: preview.errors.slice(0, 200), warnings: preview.warnings.slice(0, 50) }),
        userId,
      ],
    })
    const batchId = Number(b.lastInsertRowid)
    // Remember which source account this is (hash only), to warn if another one is imported here later.
    if (accountRef && !accountHasRef) {
      await tx.execute({ sql: `UPDATE ledger_accounts SET external_ref_hash = ? WHERE id = ? AND household_id = ? AND external_ref_hash IS NULL`, args: [accountRef, accountId, householdId] })
    }
    let inserted = 0
    for (let i = 0; i < rows.length; i++) {
      if (!isNew[i]) continue
      const r = rows[i]
      const res = await tx.execute({
        sql: `INSERT OR IGNORE INTO ledger_movements
                (household_id, account_id, booked_on, value_on, description, amount_cents, kind, category_id, dedupe_key, source, created_by_user_id, import_batch_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM ledger_categories WHERE household_id = ? AND name = ?), ?, 'import', ?, ?)`,
        args: [
          householdId, accountId, r.bookedOn, r.valueOn, r.description, r.amountCents,
          r.kind ?? (r.amountCents < 0 ? 'expense' : 'income'),
          householdId, r.category ?? null,
          keys[i], userId, batchId,
        ],
      })
      inserted += res.rowsAffected
    }
    const duplicate = rows.length - inserted
    await tx.execute({
      sql: `UPDATE import_batches SET rows_inserted = ?, rows_duplicate = ? WHERE id = ?`,
      args: [inserted, duplicate, batchId],
    })
    await tx.commit()
    return { batchId, inserted, duplicate, error: preview.counts.error }
  } catch (err) {
    await tx.rollback().catch(() => {})
    throw err
  } finally {
    tx.close()
  }
}
