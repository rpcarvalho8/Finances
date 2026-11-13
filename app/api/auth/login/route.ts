import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isSameOrigin } from '@/lib/auth/guard'
import { verifyAgainstDummy, verifyPassword } from '@/lib/auth/password'
import { clearFailures, isBlocked, recordFailure } from '@/lib/auth/rate-limit'
import { createSession, ensureForeignKeys, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const GENERIC = { error: 'Email ou password errados', code: 'BAD_CREDENTIALS' }

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origem não permitida', code: 'BAD_ORIGIN' }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }
  const { email, password } = (body ?? {}) as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }
  const normEmail = email.trim().toLowerCase()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.ip || 'local'
  const keys = [`email:${normEmail}`, `ip:${ip}`]
  if (isBlocked(keys)) {
    return NextResponse.json({ error: 'Demasiadas tentativas. Tenta daqui a 15 minutos.', code: 'RATE_LIMITED' }, { status: 429 })
  }

  await ensureForeignKeys()
  const { rows } = await getDb().execute({
    sql: `SELECT u.id, u.password_hash FROM users u
          WHERE lower(u.email) = ? AND EXISTS (SELECT 1 FROM household_members m WHERE m.user_id = u.id)`,
    args: [normEmail],
  })
  const user = rows[0]
  const ok = user ? await verifyPassword(password, String(user.password_hash)) : await verifyAgainstDummy(password)
  if (!ok || !user) {
    recordFailure(keys)
    return NextResponse.json(GENERIC, { status: 401 })
  }
  clearFailures(keys)
  const { token, expiresAt } = await createSession(Number(user.id), req.headers.get('user-agent'))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
  return res
}
