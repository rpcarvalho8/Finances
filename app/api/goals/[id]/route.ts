import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, notFound, optionalString, readJsonObject } from '@/lib/api'
import { archiveGoal, parseId, updateGoal } from '@/lib/ledger'
import { parseAmountToCents } from '@/lib/money'

type Ctx = { params: { id: string } }

function cents(v: unknown, min: number): number | undefined | null {
  if (v === undefined || v === null) return undefined
  const c = parseAmountToCents(v)
  return c === null || c < min ? null : c
}

export const PUT = withAuth<Ctx>(async (req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const name = optionalString(b.name, 100)
  const savedCents = cents(b.saved, 0)
  const targetCents = cents(b.target, 1)
  if (name === null || savedCents === null || targetCents === null) return badRequest('Valores inválidos')
  const ok = await updateGoal(user.householdId, id, { name, savedCents, targetCents })
  return ok ? NextResponse.json({ success: true }) : notFound()
})

export const DELETE = withAuth<Ctx>(async (_req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  return (await archiveGoal(user.householdId, id)) ? NextResponse.json({ success: true }) : notFound()
})
