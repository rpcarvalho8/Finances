import { NextRequest, NextResponse } from 'next/server'
import { isSameOrigin } from '@/lib/auth/guard'
import { revokeSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origem não permitida', code: 'BAD_ORIGIN' }, { status: 403 })
  await revokeSession(req.cookies.get(SESSION_COOKIE)?.value)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions())
  return res
}
