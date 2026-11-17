/**
 * Household-scoped data access. Every function takes the household id from the
 * server-side session (never from the client) and every query filters by it.
 */
import { getDb } from './db'
import { JOINT_VIEW } from './household'
import { centsToEuros } from './money'

export type View = { key: string; ownerUserId: number | null }

export const MOVEMENT_KINDS = ['expense', 'income', 'transfer', 'investment', 'savings', 'refund', 'adjustment', 'in_kind_income', 'insurance_movement'] as const
export type MovementKind = (typeof MOVEMENT_KINDS)[number]

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s))
}
export function isMonth(s: unknown): s is string {
  return typeof s === 'string' && MONTH_RE.test(s)
}

/** 'conjunta' → joint accounts; a member slug → that member's accounts; anything else → null. */
export async function resolveView(householdId: number, key: string | null | undefined): Promise<View | null> {
  if (!key) return null
  if (key === JOINT_VIEW || key === 'familia') return { key: JOINT_VIEW, ownerUserId: null }
  const { rows } = await getDb().execute({
    sql: `SELECT u.id FROM users u JOIN household_members m ON m.user_id = u.id WHERE m.household_id = ? AND u.slug = ?`,
    args: [householdId, key],
  })
  return rows[0] ? { key, ownerUserId: Number(rows[0].id) } : null
}

export async function listViews(householdId: number): Promise<Array<{ key: string; name: string }>> {
  const { rows } = await getDb().execute({
    sql: `SELECT u.slug, u.name FROM users u JOIN household_members m ON m.user_id = u.id WHERE m.household_id = ? ORDER BY u.id`,
    args: [householdId],
  })
  return [...rows.map((r) => ({ key: String(r.slug), name: String(r.name) })), { key: JOINT_VIEW, name: 'Conta Conjunta' }]
}

function ownerClause(view: View | null, alias = 'a'): { sql: string; args: Array<number> } {
  if (!view) return { sql: '', args: [] }
  return view.ownerUserId === null ? { sql: ` AND ${alias}.owner_user_id IS NULL`, args: [] } : { sql: ` AND ${alias}.owner_user_id = ?`, args: [view.ownerUserId] }
}

export type MovementRow = {
  id: number
  date: string
  description: string
  amount_cents: number
  /** Display only (cents / 100); legacy UI field. */
  amount: number
  currency: string
  type: string
  account_id: number
  account_name: string
  owner: string
  category_name: string | null
  icon: string | null
  color: string | null
  notes: string | null
}

export async function listMovements(
  householdId: number,
  opts: { view?: View | null; month?: string | null; limit?: number } = {},
): Promise<MovementRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000)
  const oc = ownerClause(opts.view ?? null)
  const args: Array<string | number> = [householdId, ...oc.args]
  let sql = `SELECT m.id, m.booked_on, m.description, m.amount_cents, m.currency, m.kind, m.notes, m.account_id,
                    a.name AS account_name, a.owner_user_id, u.slug AS owner_slug,
                    c.name AS category_name, c.icon, c.color
             FROM ledger_movements m
             JOIN ledger_accounts a ON a.id = m.account_id AND a.household_id = m.household_id
             LEFT JOIN users u ON u.id = a.owner_user_id
             LEFT JOIN ledger_categories c ON c.id = m.category_id
             WHERE m.household_id = ?${oc.sql}`
  if (opts.month) {
    sql += ` AND m.booked_on >= ? AND m.booked_on < ?`
    const [y, mo] = opts.month.split('-').map(Number)
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
    args.push(`${opts.month}-01`, `${next}-01`)
  }
  sql += ` ORDER BY m.booked_on DESC, m.id DESC LIMIT ?`
  args.push(limit)
  const { rows } = await getDb().execute({ sql, args })
  return rows.map((r) => ({
    id: Number(r.id),
    date: String(r.booked_on),
    description: String(r.description),
    amount_cents: Number(r.amount_cents),
    amount: centsToEuros(Number(r.amount_cents)),
    currency: String(r.currency),
    type: String(r.kind),
    account_id: Number(r.account_id),
    account_name: String(r.account_name),
    owner: r.owner_user_id === null ? JOINT_VIEW : String(r.owner_slug),
    category_name: r.category_name === null ? null : String(r.category_name),
    icon: r.icon === null ? null : String(r.icon),
    color: r.color === null ? null : String(r.color),
    notes: r.notes === null ? null : String(r.notes),
  }))
}

async function defaultAccountId(householdId: number, view: View): Promise<number | null> {
  const oc = ownerClause(view)
  const { rows } = await getDb().execute({
    sql: `SELECT a.id FROM ledger_accounts a WHERE a.household_id = ? AND a.archived_at IS NULL${oc.sql} ORDER BY a.is_default DESC, a.id LIMIT 1`,
    args: [householdId, ...oc.args],
  })
  return rows[0] ? Number(rows[0].id) : null
}

async function categoryId(householdId: number, name: string | null | undefined): Promise<number | null> {
  if (!name) return null
  const { rows } = await getDb().execute({
    sql: `SELECT id FROM ledger_categories WHERE household_id = ? AND name = ?`,
    args: [householdId, name],
  })
  return rows[0] ? Number(rows[0].id) : null
}

export type NewMovement = {
  view: View
  date: string
  description: string
  amountCents: number
  kind: MovementKind
  category?: string | null
  notes?: string | null
  source?: 'manual' | 'import' | 'seed'
}

export async function createMovement(householdId: number, userId: number | null, m: NewMovement): Promise<number> {
  const accountId = await defaultAccountId(householdId, m.view)
  if (accountId === null) throw new LedgerError('Não há conta para esta vista', 400)
  const r = await getDb().execute({
    sql: `INSERT INTO ledger_movements (household_id, account_id, booked_on, description, amount_cents, kind, category_id, notes, source, created_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [householdId, accountId, m.date, m.description, m.amountCents, m.kind, await categoryId(householdId, m.category), m.notes ?? null, m.source ?? 'manual', userId],
  })
  return Number(r.lastInsertRowid)
}

export async function updateMovement(
  householdId: number,
  id: number,
  patch: { date?: string; description?: string; amountCents?: number },
): Promise<boolean> {
  const r = await getDb().execute({
    sql: `UPDATE ledger_movements SET booked_on = COALESCE(?, booked_on), description = COALESCE(?, description),
            amount_cents = COALESCE(?, amount_cents), updated_at = datetime('now')
          WHERE id = ? AND household_id = ?`,
    args: [patch.date ?? null, patch.description ?? null, patch.amountCents ?? null, id, householdId],
  })
  return r.rowsAffected > 0
}

export async function deleteMovement(householdId: number, id: number): Promise<boolean> {
  const r = await getDb().execute({ sql: `DELETE FROM ledger_movements WHERE id = ? AND household_id = ?`, args: [id, householdId] })
  return r.rowsAffected > 0
}

export async function listCategories(householdId: number): Promise<Array<{ name: string; icon: string; color: string; kind: string }>> {
  const { rows } = await getDb().execute({
    sql: `SELECT name, icon, color, kind FROM ledger_categories WHERE household_id = ? ORDER BY id`,
    args: [householdId],
  })
  return rows.map((r) => ({ name: String(r.name), icon: String(r.icon), color: String(r.color), kind: String(r.kind) }))
}

// ── Goals ────────────────────────────────────────────────────────────────

export type GoalRow = { id: number; name: string; icon: string; color: string; owner: string; target_cents: number; saved_cents: number; target: number; saved: number }

export async function listGoals(householdId: number, view: View | null): Promise<GoalRow[]> {
  // A member's view shows their goals plus the family goals (previous behaviour).
  let sql = `SELECT g.*, u.slug AS owner_slug FROM household_goals g LEFT JOIN users u ON u.id = g.owner_user_id WHERE g.household_id = ? AND g.active = 1`
  const args: Array<number> = [householdId]
  if (view && view.ownerUserId !== null) {
    sql += ` AND (g.owner_user_id = ? OR g.owner_user_id IS NULL)`
    args.push(view.ownerUserId)
  } else if (view) {
    sql += ` AND g.owner_user_id IS NULL`
  }
  sql += ` ORDER BY g.name`
  const { rows } = await getDb().execute({ sql, args })
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    icon: String(r.icon),
    color: String(r.color),
    owner: r.owner_user_id === null ? 'familia' : String(r.owner_slug),
    target_cents: Number(r.target_cents),
    saved_cents: Number(r.saved_cents),
    target: centsToEuros(Number(r.target_cents)),
    saved: centsToEuros(Number(r.saved_cents)),
  }))
}

export async function createGoal(
  householdId: number,
  g: { view: View; name: string; icon?: string; color?: string; targetCents: number; savedCents?: number },
): Promise<number> {
  const r = await getDb().execute({
    sql: `INSERT INTO household_goals (household_id, owner_user_id, name, icon, color, target_cents, saved_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [householdId, g.view.ownerUserId, g.name, g.icon ?? '🎯', g.color ?? '#c8f97e', g.targetCents, g.savedCents ?? 0],
  })
  return Number(r.lastInsertRowid)
}

export async function updateGoal(householdId: number, id: number, p: { name?: string; targetCents?: number; savedCents?: number }): Promise<boolean> {
  const r = await getDb().execute({
    sql: `UPDATE household_goals SET name = COALESCE(?, name), target_cents = COALESCE(?, target_cents), saved_cents = COALESCE(?, saved_cents)
          WHERE id = ? AND household_id = ?`,
    args: [p.name ?? null, p.targetCents ?? null, p.savedCents ?? null, id, householdId],
  })
  return r.rowsAffected > 0
}

export async function archiveGoal(householdId: number, id: number): Promise<boolean> {
  const r = await getDb().execute({ sql: `UPDATE household_goals SET active = 0 WHERE id = ? AND household_id = ?`, args: [id, householdId] })
  return r.rowsAffected > 0
}

// ── Settings (budgets) ───────────────────────────────────────────────────

export async function getSetting(householdId: number, key: string): Promise<string | null> {
  const { rows } = await getDb().execute({ sql: `SELECT value FROM household_settings WHERE household_id = ? AND key = ?`, args: [householdId, key] })
  return rows[0] ? String(rows[0].value) : null
}

export async function setSetting(householdId: number, key: string, value: string): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO household_settings (household_id, key, value) VALUES (?, ?, ?) ON CONFLICT(household_id, key) DO UPDATE SET value = excluded.value`,
    args: [householdId, key, value],
  })
}

export class LedgerError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export function parseId(raw: string): number | null {
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null
}
