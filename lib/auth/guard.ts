import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, validateSession, type SessionUser } from './session'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie auth: a state-changing request must come from this
 * origin. Browsers always send Origin on cross-site POST/PUT/DELETE.
 */
export function isSameOrigin(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return true
  const origin = req.headers.get('origin')
  if (!origin) {
    // Non-browser clients (curl, scripts) send no Origin; Sec-Fetch-Site still flags browser cross-site requests.
    const site = req.headers.get('sec-fetch-site')
    return !site || site === 'same-origin' || site === 'none'
  }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function authenticate(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await validateSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHENTICATED' }, { status: 401 })
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origem não permitida', code: 'BAD_ORIGIN' }, { status: 403 })
  return user
}

type Handler<C> = (req: NextRequest, ctx: C, user: SessionUser) => Promise<Response> | Response

/**
 * Every data route handler is wrapped with this. Authorization happens here, on the
 * server, from the session cookie only (never from owner/user ids sent by the client).
 * The middleware only redirects; it is not a security boundary.
 */
export function withAuth<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const auth = await authenticate(req)
    if (auth instanceof NextResponse) return auth
    return handler(req, ctx, auth)
  }
}
