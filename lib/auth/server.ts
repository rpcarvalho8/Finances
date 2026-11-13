import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, validateSession, type SessionUser } from './session'

/** For Server Components: the current user, or a redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await validateSession(cookies().get(SESSION_COOKIE)?.value)
  if (!user) redirect('/login')
  return user
}
