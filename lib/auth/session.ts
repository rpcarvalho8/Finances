import crypto from 'crypto'
import { getDb } from '../db'

export const SESSION_COOKIE = 'fos_session'
export const SESSION_TTL_DAYS = 30
/** Sliding expiry is refreshed at most once per hour to avoid a write per request. */
const REFRESH_AFTER_MS = 60 * 60 * 1000

export type SessionUser = {
  userId: number
  name: string
  email: string
  slug: string
  householdId: number
  role: 'owner' | 'member'
  sessionId: string
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function isoIn(days: number, from = Date.now()): string {
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString()
}

let fkReady: Promise<unknown> | null = null
/** SQLite only enforces FOREIGN KEY with this pragma on the connection. */
export function ensureForeignKeys(): Promise<unknown> {
  fkReady ??= getDb().execute('PRAGMA foreign_keys = ON')
  return fkReady
}
export function resetForeignKeysFlag(): void {
  fkReady = null
}

export async function createSession(userId: number, userAgent: string | null): Promise<{ token: string; expiresAt: string }> {
  await ensureForeignKeys()
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = isoIn(SESSION_TTL_DAYS)
  await getDb().execute({
    sql: `INSERT INTO sessions (id, user_id, expires_at, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
    args: [hashToken(token), userId, expiresAt, userAgent ? userAgent.slice(0, 200) : null, new Date().toISOString()],
  })
  return { token, expiresAt }
}

/** Returns the user for a valid, unexpired session token, or null. Never trusts anything but the token. */
export async function validateSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null
  await ensureForeignKeys()
  const id = hashToken(token)
  const { rows } = await getDb().execute({
    sql: `SELECT s.id, s.expires_at, s.last_seen_at, u.id AS user_id, u.name, u.email, u.slug, m.household_id, m.role
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          JOIN household_members m ON m.user_id = u.id
          WHERE s.id = ?
          ORDER BY m.household_id
          LIMIT 1`,
    args: [id],
  })
  const r = rows[0]
  if (!r) return null
  const now = Date.now()
  if (Date.parse(String(r.expires_at)) <= now) {
    await getDb().execute({ sql: `DELETE FROM sessions WHERE id = ?`, args: [id] })
    return null
  }
  if (now - Date.parse(String(r.last_seen_at)) > REFRESH_AFTER_MS) {
    await getDb().execute({
      sql: `UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?`,
      args: [new Date(now).toISOString(), isoIn(SESSION_TTL_DAYS, now), id],
    })
  }
  return {
    userId: Number(r.user_id),
    name: String(r.name),
    email: String(r.email),
    slug: String(r.slug ?? ''),
    householdId: Number(r.household_id),
    role: String(r.role) === 'owner' ? 'owner' : 'member',
    sessionId: id,
  }
}

export async function revokeSession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await getDb().execute({ sql: `DELETE FROM sessions WHERE id = ?`, args: [hashToken(token)] })
}

export async function revokeAllSessions(userId: number): Promise<void> {
  await getDb().execute({ sql: `DELETE FROM sessions WHERE user_id = ?`, args: [userId] })
}

export async function purgeExpiredSessions(): Promise<number> {
  const r = await getDb().execute({ sql: `DELETE FROM sessions WHERE expires_at <= ?`, args: [new Date().toISOString()] })
  return r.rowsAffected
}

/**
 * Cookie flags. `Secure` is on when COOKIE_SECURE=true (use it behind HTTPS).
 * On the home LAN over plain http (OPS-D01) the browser would drop a Secure cookie,
 * so it defaults to off there.
 */
export function sessionCookieOptions(expiresAt?: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    ...(expiresAt ? { expires: new Date(expiresAt) } : { maxAge: 0 }),
  }
}
