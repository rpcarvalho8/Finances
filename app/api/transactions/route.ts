import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, ledgerErrorResponse, optionalString, readJsonObject } from '@/lib/api'
import { createMovement, isIsoDate, isMonth, listMovements, MOVEMENT_KINDS, resolveView, type MovementKind } from '@/lib/ledger'
import { parseAmountToCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (req: NextRequest, _ctx, user) => {
  const p = new URL(req.url).searchParams
  const ownerKey = p.get('owner')
  const month = p.get('month')
  if (month && !isMonth(month)) return badRequest('Mês inválido (AAAA-MM)')
  const view = ownerKey ? await resolveView(user.householdId, ownerKey) : null
  if (ownerKey && !view) return NextResponse.json([])
  const limit = Number.parseInt(p.get('limit') || '100', 10)
  const rows = await listMovements(user.householdId, { view, month, limit: Number.isFinite(limit) ? limit : 100 })
  return NextResponse.json(rows)
})

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const description = optionalString(b.description)
  if (!isIsoDate(b.date) || !description || b.amount === undefined || typeof b.type !== 'string' || typeof b.owner !== 'string') {
    return badRequest('Campos em falta ou inválidos')
  }
  if (!(MOVEMENT_KINDS as readonly string[]).includes(b.type)) return badRequest('Tipo de movimento inválido')
  const amountCents = parseAmountToCents(b.amount)
  if (amountCents === null) return badRequest('Montante inválido')
  const view = await resolveView(user.householdId, b.owner)
  if (!view) return badRequest('Conta/pessoa desconhecida')
  const notes = optionalString(b.notes, 1000)
  const category = optionalString(b.category)
  try {
    const id = await createMovement(user.householdId, user.userId, {
      view,
      date: b.date,
      description,
      amountCents,
      kind: b.type as MovementKind,
      category: category || null,
      notes: notes || null,
    })
    return NextResponse.json({ id, success: true })
  } catch (err) {
    return ledgerErrorResponse(err)
  }
})
