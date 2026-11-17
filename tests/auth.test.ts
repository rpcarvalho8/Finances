import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic users and passwords only.
const PW = 'synthetic-password-123'

let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-auth-'))
  process.env.DATABASE_URL = `file:${path.join(tmpDir, 'finance.db')}`
  const { migrate } = await import('@/lib/migrate')
  await migrate({ backup: false })
  const { resetRateLimit } = await import('@/lib/auth/rate-limit')
  resetRateLimit()
})

afterEach(async () => {
  const { closeDb } = await import('@/lib/db')
  const { resetForeignKeysFlag } = await import('@/lib/auth/session')
  closeDb()
  resetForeignKeysFlag()
  delete process.env.DATABASE_URL
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function req(url: string, init: { method?: string; cookie?: string; origin?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { host: 'localhost:3002' }
  if (init.cookie) headers.cookie = `fos_session=${init.cookie}`
  if (init.origin) headers.origin = init.origin
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(`http://localhost:3002${url}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

async function login(email: string, password: string, origin = 'http://localhost:3002') {
  const { POST } = await import('@/app/api/auth/login/route')
  return POST(req('/api/auth/login', { method: 'POST', origin, body: { email, password } }))
}

function tokenFrom(res: Response): string {
  const set = res.headers.get('set-cookie') ?? ''
  const m = /fos_session=([^;]+)/.exec(set)
  if (!m) throw new Error('no session cookie')
  return m[1]
}

describe('passwords', () => {
  it('hashes with scrypt and verifies', async () => {
    const { hashPassword, verifyPassword } = await import('@/lib/auth/password')
    const h = await hashPassword(PW)
    expect(h.startsWith('scrypt$')).toBe(true)
    expect(h).not.toContain(PW)
    expect(await verifyPassword(PW, h)).toBe(true)
    expect(await verifyPassword(PW + 'x', h)).toBe(false)
    expect(await verifyPassword(PW, 'garbage')).toBe(false)
    await expect(hashPassword('short')).rejects.toThrow(/12/)
  })
})

describe('login / logout', () => {
  it('logs in a household member, sets an HttpOnly SameSite cookie, and /me works', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    const res = await login('A@Example.test', PW)
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    const { GET } = await import('@/app/api/auth/me/route')
    const me = await GET(req('/api/auth/me', { cookie: tokenFrom(res) }), {})
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ email: 'a@example.test', role: 'owner' })
  })

  it('stores only the hash of the session token', async () => {
    const { addUser } = await import('@/lib/auth/users')
    const { db } = await import('@/lib/db')
    await addUser('Utilizador A', 'a@example.test', PW)
    const token = tokenFrom(await login('a@example.test', PW))
    const { rows } = await db.execute(`SELECT id FROM sessions`)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(token)
    expect(String(rows[0].id)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects wrong password and unknown email with the same 401', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    const a = await login('a@example.test', 'wrong-password-000')
    const b = await login('nobody@example.test', PW)
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(await a.json()).toEqual(await b.json())
  })

  it('throttles after 5 failures (429)', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    for (let i = 0; i < 5; i++) expect((await login('a@example.test', 'wrong-password-000')).status).toBe(401)
    expect((await login('a@example.test', PW)).status).toBe(429)
  })

  it('refuses a cross-site login (403)', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    expect((await login('a@example.test', PW, 'https://evil.example')).status).toBe(403)
  })

  it('logout revokes the session', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    const token = tokenFrom(await login('a@example.test', PW))
    const { POST } = await import('@/app/api/auth/logout/route')
    expect((await POST(req('/api/auth/logout', { method: 'POST', cookie: token, origin: 'http://localhost:3002' }))).status).toBe(200)
    const { validateSession } = await import('@/lib/auth/session')
    expect(await validateSession(token)).toBeNull()
  })

  it('changing the password signs the user out everywhere', async () => {
    const { addUser, setPassword } = await import('@/lib/auth/users')
    const { validateSession } = await import('@/lib/auth/session')
    await addUser('Utilizador A', 'a@example.test', PW)
    const token = tokenFrom(await login('a@example.test', PW))
    await setPassword('a@example.test', 'another-synthetic-pw-456')
    expect(await validateSession(token)).toBeNull()
    expect((await login('a@example.test', PW)).status).toBe(401)
  })
})

describe('sessions', () => {
  it('expired sessions are rejected and deleted', async () => {
    const { addUser } = await import('@/lib/auth/users')
    const { createSession, validateSession } = await import('@/lib/auth/session')
    const { db } = await import('@/lib/db')
    const id = await addUser('Utilizador A', 'a@example.test', PW)
    const { token } = await createSession(id, null)
    await db.execute(`UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'`)
    expect(await validateSession(token)).toBeNull()
    expect((await db.execute(`SELECT COUNT(*) AS n FROM sessions`)).rows[0].n).toBe(0)
  })

  it('second user joins the same household as member', async () => {
    const { addUser } = await import('@/lib/auth/users')
    const { db } = await import('@/lib/db')
    await addUser('Utilizador A', 'a@example.test', PW)
    await addUser('Utilizador B', 'b@example.test', PW)
    await expect(addUser('Dup', 'B@example.test', PW)).rejects.toThrow(/Já existe/)
    const { rows } = await db.execute(`SELECT household_id, role FROM household_members ORDER BY user_id`)
    expect(rows.map((r) => [Number(r.household_id), r.role])).toEqual([[1, 'owner'], [1, 'member']])
  })
})

describe('every data API requires a session', () => {
  const routes: Array<[string, string[], Record<string, unknown>]> = [
    ['transactions', ['GET', 'POST'], {}],
    ['transactions/[id]', ['PUT', 'DELETE'], { params: { id: '1' } }],
    ['goals', ['GET', 'POST'], {}],
    ['goals/[id]', ['PUT', 'DELETE'], { params: { id: '1' } }],
    ['investments', ['GET', 'POST'], {}],
    ['investments/[id]', ['PUT', 'DELETE'], { params: { id: '1' } }],
    ['settings/budgets', ['GET', 'POST'], {}],
    ['auth/me', ['GET'], {}],
  ]
  for (const [route, methods, ctx] of routes) {
    for (const method of methods) {
      it(`${method} /api/${route} → 401 without cookie, 401 with a forged cookie`, async () => {
        const mod = (await import(`@/app/api/${route}/route`)) as Record<string, (r: NextRequest, c: unknown) => Promise<Response>>
        expect((await mod[method](req(`/api/${route}`, { method }), ctx)).status).toBe(401)
        expect((await mod[method](req(`/api/${route}`, { method, cookie: 'x'.repeat(43) }), ctx)).status).toBe(401)
      })
    }
  }

  it('a valid session reads data; a cross-site write is refused (403)', async () => {
    const { addUser } = await import('@/lib/auth/users')
    await addUser('Utilizador A', 'a@example.test', PW)
    const token = tokenFrom(await login('a@example.test', PW))
    const { GET, POST } = await import('@/app/api/transactions/route')
    expect((await GET(req('/api/transactions', { cookie: token }), {})).status).toBe(200)
    const bad = await POST(req('/api/transactions', { method: 'POST', cookie: token, origin: 'https://evil.example', body: {} }), {})
    expect(bad.status).toBe(403)
  })

  it('no route handler under app/api is left unprotected by accident', () => {
    const allowed = new Set(['auth/login', 'auth/logout', 'health'])
    const root = path.resolve('app/api')
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    for (const file of walk(root).filter((f) => f.endsWith('route.ts'))) {
      const rel = path.relative(root, path.dirname(file)).split(path.sep).join('/')
      if (allowed.has(rel)) continue
      const src = fs.readFileSync(file, 'utf8')
      const ok = /withAuth(<[^>]*>)?\(/.test(src) || src.includes('disabledFeature(')
      expect(ok, `app/api/${rel}/route.ts must use withAuth`).toBe(true)
      expect(/export async function (GET|POST|PUT|DELETE|PATCH)/.test(src), `app/api/${rel}: raw handler export`).toBe(false)
    }
  })
})
