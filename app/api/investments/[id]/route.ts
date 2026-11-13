import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, notFound, readJsonObject } from '@/lib/api'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/ledger'
import { centsToEuros, parseAmountToCents } from '@/lib/money'

type Ctx = { params: { id: string } }

function euros(v: unknown): number | undefined | null {
  if (v === undefined || v === null) return undefined
  const c = parseAmountToCents(v)
  return c === null ? null : centsToEuros(c)
}

export const PUT = withAuth<Ctx>(async (req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const current = euros(b.current_value)
  const invested = euros(b.invested)
  if (current === null || invested === null) return badRequest('Montante inválido')
  const r = await getDb().execute({
    sql: `UPDATE investments SET current_value = COALESCE(?, current_value), invested = COALESCE(?, invested), last_updated = datetime('now') WHERE id = ? AND household_id = ?`,
    args: [current ?? null, invested ?? null, id, user.householdId],
  })
  return r.rowsAffected > 0 ? NextResponse.json({ success: true }) : notFound()
})

export const DELETE = withAuth<Ctx>(async (_req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  const r = await getDb().execute({ sql: `DELETE FROM investments WHERE id = ? AND household_id = ?`, args: [id, user.householdId] })
  return r.rowsAffected > 0 ? NextResponse.json({ success: true }) : notFound()
})
