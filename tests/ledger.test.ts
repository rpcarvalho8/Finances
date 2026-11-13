import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Synthetic users, households and amounts only.
const PW = 'synthetic-password-123'
const ORIGIN = 'http://localhost:3002'

let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-os-ledger-'))
  process.env.DATABASE_URL = `file:${path.join(tmpDir, 'finance.db')}`
  const { migrate } = await import('@/lib/migrate')
  await migrate({ backup: false })
})

afterEach(async () => {
  const { closeDb } = await import('@/lib/db')
  const { resetForeignKeysFlag } = await import('@/lib/auth/session')
  closeDb()
  resetForeignKeysFlag()
  delete process.env.DATABASE_URL
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function req(url: string, token: string, init: { method?: string; body?: unknown } = {}) {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = { host: 'localhost:3002', cookie: `fos_session=${token}` }
  if (method !== 'GET') headers.origin = ORIGIN
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(`${ORIGIN}${url}`, { method, headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined })
}

async function userWithSession(name: string, email: string, opts: { newHousehold?: boolean } = {}) {
  const { addUser } = await import('@/lib/auth/users')
  const { createSession } = await import('@/lib/auth/session')
  const id = await addUser(name, email, PW, opts)
  const { token } = await createSession(id, null)
  return { id, token }
}

type Handler = (r: NextRequest, c: unknown) => Promise<Response>
async function route(name: string): Promise<Record<string, Handler>> {
  return (await import(`@/app/api/${name}/route`)) as Record<string, Handler>
}

describe('money parsing', () => {
  it('parses euro strings and numbers into integer cents', async () => {
    const { parseAmountToCents } = await import('@/lib/money')
    expect(parseAmountToCents('12,34')).toBe(1234)
    expect(parseAmountToCents('-12.3')).toBe(-1230)
    expect(parseAmountToCents('1 234,56')).toBe(123456)
    expect(parseAmountToCents('1234.56 €')).toBe(123456)
    expect(parseAmountToCents(0.1 + 0.2)).toBe(30)
    expect(parseAmountToCents(-45.3)).toBe(-4530)
    expect(parseAmountToCents('12')).toBe(1200)
  })
  it('rejects anything that is not a clean amount', async () => {
    const { parseAmountToCents } = await import('@/lib/money')
    for (const bad of ['', 'abc', '1,234.56', '12.345', '1e5', NaN, Infinity, null, undefined, {}, '--1', '9'.repeat(20)]) {
      expect(parseAmountToCents(bad), String(bad)).toBeNull()
    }
  })
})

describe('household isolation', () => {
  it('a member of household A cannot read, change or delete household B data by id', async () => {
    const a = await userWithSession('Membro A', 'a@example.test')
    const b = await userWithSession('Membro B', 'b@example.test', { newHousehold: true })

    // B creates a movement, a goal and an investment.
    const tx = await route('transactions')
    const created = await tx.POST(req('/api/transactions', b.token, { method: 'POST', body: { date: '2026-01-05', description: 'EXEMPLO B', amount: '-12,34', type: 'expense', owner: 'conjunta', category: 'Alimentação' } }), {})
    expect(created.status).toBe(200)
    const mid = String((await created.json()).id)
    const goal = await (await route('goals')).POST(req('/api/goals', b.token, { method: 'POST', body: { name: 'Meta B', target: '100' } }), {})
    expect(goal.status).toBe(200)
    const gid = String((await goal.json()).id)
    const inv = await (await route('investments')).POST(req('/api/investments', b.token, { method: 'POST', body: { platform: 'Exemplo B', invested: 10, current_value: 11 } }), {})
    expect(inv.status).toBe(200)
    const iid = String((await inv.json()).id)

    // A sees none of it.
    const listA = await tx.GET(req('/api/transactions', a.token), {})
    expect(await listA.json()).toEqual([])
    expect(await (await (await route('goals')).GET(req('/api/goals', a.token), {})).json()).toEqual([])
    expect(await (await (await route('investments')).GET(req('/api/investments', a.token), {})).json()).toEqual([])

    // A cannot touch it by id (404, not 200).
    const txId = await route('transactions/[id]')
    expect((await txId.PUT(req(`/api/transactions/${mid}`, a.token, { method: 'PUT', body: { amount: '1' } }), { params: { id: mid } })).status).toBe(404)
    expect((await txId.DELETE(req(`/api/transactions/${mid}`, a.token, { method: 'DELETE' }), { params: { id: mid } })).status).toBe(404)
    const goalId = await route('goals/[id]')
    expect((await goalId.PUT(req(`/api/goals/${gid}`, a.token, { method: 'PUT', body: { saved: 1 } }), { params: { id: gid } })).status).toBe(404)
    expect((await goalId.DELETE(req(`/api/goals/${gid}`, a.token, { method: 'DELETE' }), { params: { id: gid } })).status).toBe(404)
    const invId = await route('investments/[id]')
    expect((await invId.PUT(req(`/api/investments/${iid}`, a.token, { method: 'PUT', body: { current_value: 1 } }), { params: { id: iid } })).status).toBe(404)
    expect((await invId.DELETE(req(`/api/investments/${iid}`, a.token, { method: 'DELETE' }), { params: { id: iid } })).status).toBe(404)

    // A cannot target B's member view either.
    const cross = await tx.POST(req('/api/transactions', a.token, { method: 'POST', body: { date: '2026-01-05', description: 'X', amount: 1, type: 'income', owner: 'membro-b' } }), {})
    expect(cross.status).toBe(400)

    // B's data is intact and amounts are exact cents.
    const listB = (await (await tx.GET(req('/api/transactions', b.token), {})).json()) as Array<{ amount_cents: number; owner: string }>
    expect(listB).toHaveLength(1)
    expect(listB[0].amount_cents).toBe(-1234)
    expect(listB[0].owner).toBe('conjunta')
    const goalsB = (await (await (await route('goals')).GET(req('/api/goals', b.token), {})).json()) as Array<{ saved_cents: number }>
    expect(goalsB[0].saved_cents).toBe(0)

    // B can change and delete its own movement.
    expect((await txId.PUT(req(`/api/transactions/${mid}`, b.token, { method: 'PUT', body: { amount: '-1,05' } }), { params: { id: mid } })).status).toBe(200)
    expect((await txId.DELETE(req(`/api/transactions/${mid}`, b.token, { method: 'DELETE' }), { params: { id: mid } })).status).toBe(200)
  })

  it('budgets are stored per household', async () => {
    const a = await userWithSession('Membro A', 'a@example.test')
    const b = await userWithSession('Membro B', 'b@example.test', { newHousehold: true })
    const bud = await route('settings/budgets')
    expect((await bud.POST(req('/api/settings/budgets', a.token, { method: 'POST', body: { rui_income: '1000', nested: { x: 1 } } }), {})).status).toBe(200)
    expect((await (await bud.GET(req('/api/settings/budgets', a.token), {})).json()).rui_income).toBe('1000')
    expect((await (await bud.GET(req('/api/settings/budgets', b.token), {})).json()).rui_income).toBe('')
  })

  it('the database refuses a movement whose account belongs to another household', async () => {
    const a = await userWithSession('Membro A', 'a@example.test')
    await userWithSession('Membro B', 'b@example.test', { newHousehold: true })
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    const hhA = Number((await db.execute({ sql: `SELECT household_id FROM household_members WHERE user_id = ?`, args: [a.id] })).rows[0].household_id)
    const accB = Number((await db.execute({ sql: `SELECT id FROM ledger_accounts WHERE household_id <> ? LIMIT 1`, args: [hhA] })).rows[0].id)
    await expect(
      db.execute({
        sql: `INSERT INTO ledger_movements (household_id, account_id, booked_on, description, amount_cents, kind) VALUES (?, ?, '2026-01-01', 'X', 100, 'income')`,
        args: [hhA, accB],
      }),
    ).rejects.toThrow()
    // Float amounts are refused by the schema too.
    const accA = Number((await db.execute({ sql: `SELECT id FROM ledger_accounts WHERE household_id = ? LIMIT 1`, args: [hhA] })).rows[0].id)
    await expect(
      db.execute({
        sql: `INSERT INTO ledger_movements (household_id, account_id, booked_on, description, amount_cents, kind) VALUES (?, ?, '2026-01-01', 'X', 1.5, 'income')`,
        args: [hhA, accA],
      }),
    ).rejects.toThrow()
  })
})

describe('input validation', () => {
  it('rejects bad dates, kinds and amounts with 400', async () => {
    const a = await userWithSession('Membro A', 'a@example.test')
    const tx = await route('transactions')
    const base = { date: '2026-01-05', description: 'EXEMPLO', amount: '1,00', type: 'income', owner: 'membro-a' }
    expect((await tx.POST(req('/api/transactions', a.token, { method: 'POST', body: base }), {})).status).toBe(200)
    for (const patch of [{ date: '2026-13-01' }, { type: 'gift' }, { amount: '1,2,3' }, { owner: 'desconhecido' }, { description: '' }]) {
      const res = await tx.POST(req('/api/transactions', a.token, { method: 'POST', body: { ...base, ...patch } }), {})
      expect(res.status, JSON.stringify(patch)).toBe(400)
    }
    expect((await tx.GET(req('/api/transactions?month=2026-1', a.token), {})).status).toBe(400)
    const idRoute = await route('transactions/[id]')
    expect((await idRoute.DELETE(req('/api/transactions/abc', a.token, { method: 'DELETE' }), { params: { id: 'abc' } })).status).toBe(404)
  })
})

describe('synthetic seed', () => {
  it('fills one household and refuses to overwrite without --force', async () => {
    await userWithSession('Membro A', 'a@example.test')
    await userWithSession('Membro B', 'b@example.test')
    const { getDb } = await import('@/lib/db')
    const { seedHousehold, syntheticTransactions } = await import('@/scripts/seed')
    const hh = Number((await getDb().execute(`SELECT id FROM households LIMIT 1`)).rows[0].id)
    const n = await seedHousehold(hh)
    expect(n).toBe(syntheticTransactions().length)
    await expect(seedHousehold(hh)).rejects.toThrow(/--force/)
    expect(await seedHousehold(hh, { force: true })).toBe(n)
    const { listMovements } = await import('@/lib/ledger')
    const jan = await listMovements(hh, { month: '2026-01', limit: 1000 })
    expect(jan.length).toBe(n / 3)
    expect(jan.every((m) => Number.isInteger(m.amount_cents))).toBe(true)
  })
})
