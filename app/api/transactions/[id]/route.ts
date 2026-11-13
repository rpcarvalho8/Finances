import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, notFound, optionalString, readJsonObject } from '@/lib/api'
import { deleteMovement, isIsoDate, parseId, updateMovement } from '@/lib/ledger'
import { parseAmountToCents } from '@/lib/money'

type Ctx = { params: { id: string } }

export const PUT = withAuth<Ctx>(async (req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  if (b.date !== undefined && !isIsoDate(b.date)) return badRequest('Data inválida')
  const description = optionalString(b.description)
  if (description === null) return badRequest('Descrição inválida')
  let amountCents: number | undefined
  if (b.amount !== undefined) {
    const c = parseAmountToCents(b.amount)
    if (c === null) return badRequest('Montante inválido')
    amountCents = c
  }
  const ok = await updateMovement(user.householdId, id, { date: b.date as string | undefined, description, amountCents })
  return ok ? NextResponse.json({ success: true }) : notFound()
})

export const DELETE = withAuth<Ctx>(async (_req: NextRequest, { params }, user) => {
  const id = parseId(params.id)
  if (id === null) return notFound()
  return (await deleteMovement(user.householdId, id)) ? NextResponse.json({ success: true }) : notFound()
})
