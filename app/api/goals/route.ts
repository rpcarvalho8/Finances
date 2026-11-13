import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, optionalString, readJsonObject } from '@/lib/api'
import { createGoal, listGoals, resolveView } from '@/lib/ledger'
import { parseAmountToCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (req: NextRequest, _ctx, user) => {
  const ownerKey = new URL(req.url).searchParams.get('owner')
  const view = ownerKey ? await resolveView(user.householdId, ownerKey) : null
  if (ownerKey && !view) return NextResponse.json([])
  return NextResponse.json(await listGoals(user.householdId, view))
})

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const name = optionalString(b.name, 100)
  if (!name) return badRequest('Nome inválido')
  const targetCents = parseAmountToCents(b.target)
  if (targetCents === null || targetCents <= 0) return badRequest('Objetivo inválido')
  const savedCents = b.saved === undefined || b.saved === '' ? 0 : parseAmountToCents(b.saved)
  if (savedCents === null || savedCents < 0) return badRequest('Valor poupado inválido')
  const view = await resolveView(user.householdId, typeof b.owner === 'string' ? b.owner : user.slug)
  if (!view) return badRequest('Pessoa desconhecida')
  const id = await createGoal(user.householdId, {
    view,
    name,
    icon: optionalString(b.icon, 16) || undefined,
    color: optionalString(b.color, 16) || undefined,
    targetCents,
    savedCents,
  })
  return NextResponse.json({ id, success: true })
})
