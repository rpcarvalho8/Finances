import { getDb } from '../db'
import { hashPassword } from './password'
import { ensureForeignKeys, revokeAllSessions } from './session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Creates a user and adds them to the household (created on first use).
 * The first user becomes the household owner. One household per installation for now.
 */
export async function addUser(name: string, email: string, password: string, householdName = 'Agregado'): Promise<number> {
  const normEmail = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Nome obrigatório')
  if (!EMAIL_RE.test(normEmail)) throw new Error('Email inválido')
  const hash = await hashPassword(password)
  await ensureForeignKeys()
  const db = getDb()
  const tx = await db.transaction('write')
  try {
    const exists = await tx.execute({ sql: `SELECT 1 FROM users WHERE lower(email) = ?`, args: [normEmail] })
    if (exists.rows.length) throw new Error('Já existe um utilizador com esse email')
    let hh = await tx.execute(`SELECT id FROM households ORDER BY id LIMIT 1`)
    if (!hh.rows.length) {
      await tx.execute({ sql: `INSERT INTO households (name) VALUES (?)`, args: [householdName] })
      hh = await tx.execute(`SELECT id FROM households ORDER BY id LIMIT 1`)
    }
    const householdId = Number(hh.rows[0].id)
    const owners = await tx.execute({ sql: `SELECT COUNT(*) AS n FROM household_members WHERE household_id = ?`, args: [householdId] })
    const u = await tx.execute({
      sql: `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')`,
      args: [name.trim(), normEmail, hash],
    })
    const userId = Number(u.lastInsertRowid)
    await tx.execute({
      sql: `INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)`,
      args: [householdId, userId, Number(owners.rows[0].n) === 0 ? 'owner' : 'member'],
    })
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
