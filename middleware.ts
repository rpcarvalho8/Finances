import { NextRequest, NextResponse } from 'next/server'

/**
 * Convenience only: sends visitors without a session cookie to /login.
 * It does NOT validate the session; every API handler does that on the server
 * (lib/auth/guard.ts withAuth), and pages call requireUser().
 */
const COOKIE = 'fos_session'
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/health'])

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()
  if (req.cookies.get(COOKIE)?.value) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada', code: 'UNAUTHENTICATED' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
