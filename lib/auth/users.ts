import { getDb } from '../db'
import { ensureHouseholdDefaults, ensureMemberDefaults, JOINT_VIEW, slugify } from '../household'
import { hashPassword } from './password'
import { ensureForeignKeys, revokeAllSessions } from './session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AddUserOptions = {
  householdName?: string
  /** Create a separate household instead of joining the first one (tests / future multi-household). */
  newHousehold?: boolean
  slug?: string
}

/**
 * Creates a user and adds them to the household (created on first use), with the
 * household's default categories and accounts. The first member becomes the owner.
 */
export async function addUser(name: string, email: string, password: string, opts: AddUserOptions = {}): Promise<number> {
  const normEmail = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Nome obrigatório')
  const slug = opts.slug ?? slugify(name)
  if (!slug || slug === JOINT_VIEW || slug === 'familia') throw new Error(`Nome curto inválido: "${slug}"`)
  if (!EMAIL_RE.test(normEmail)) throw new Error('Email inválido')
  const hash = await hashPassword(password)
  await ensureForeignKeys()
  const db = getDb()
  const tx = await db.transaction('write')
  try {
    const exists = await tx.execute({ sql: `SELECT 1 FROM users WHERE lower(email) = ?`, args: [normEmail] })
    if (exists.rows.length) throw new Error('Já existe um utilizador com esse email')
    const slugTaken = await tx.execute({ sql: `SELECT 1 FROM users WHERE slug = ?`, args: [slug] })
    if (slugTaken.rows.length) throw new Error(`Já existe um utilizador com o nome curto "${slug}"`)
    let householdId: number
    const hh = await tx.execute(`SELECT id FROM households ORDER BY id LIMIT 1`)
    if (hh.rows.length && !opts.newHousehold) {
      householdId = Number(hh.rows[0].id)
    } else {
      const ins = await tx.execute({ sql: `INSERT INTO households (name) VALUES (?)`, args: [opts.householdName ?? 'Agregado'] })
      householdId = Number(ins.lastInsertRowid)
    }
    await ensureHouseholdDefaults(tx, householdId)
    const owners = await tx.execute({ sql: `SELECT COUNT(*) AS n FROM household_members WHERE household_id = ?`, args: [householdId] })
    const u = await tx.execute({
      sql: `INSERT INTO users (name, email, password_hash, role, slug) VALUES (?, ?, ?, 'member', ?)`,
      args: [name.trim(), normEmail, hash, slug],
    })
    const userId = Number(u.lastInsertRowid)
    await tx.execute({
      sql: `INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)`,
      args: [householdId, userId, Number(owners.rows[0].n) === 0 ? 'owner' : 'member'],
    })
    await ensureMemberDefaults(tx, householdId, userId)
    await tx.commit()
    return userId
  } catch (err) {
    await tx.rollback().catch(() => {})
    throw err
  } finally {
    tx.close()
  }
}

/** Changes the password and signs the user out everywhere. */
export async function setPassword(email: string, password: string): Promise<void> {
  const hash = await hashPassword(password)
  const r = await getDb().execute({ sql: `UPDATE users SET password_hash = ? WHERE lower(email) = ?`, args: [hash, email.trim().toLowerCase()] })
  if (r.rowsAffected === 0) throw new Error('Utilizador não encontrado')
  const { rows } = await getDb().execute({ sql: `SELECT id FROM users WHERE lower(email) = ?`, args: [email.trim().toLowerCase()] })
  await revokeAllSessions(Number(rows[0].id))
}

export async function listUsers(): Promise<Array<{ name: string; email: string; role: string }>> {
  const { rows } = await getDb().execute(
    `SELECT u.name, u.email, COALESCE(m.role, '-') AS role FROM users u LEFT JOIN household_members m ON m.user_id = u.id ORDER BY u.id`,
  )
  return rows.map((r) => ({ name: String(r.name), email: String(r.email), role: String(r.role) }))
}
