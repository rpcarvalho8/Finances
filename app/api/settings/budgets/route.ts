import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, readJsonObject } from '@/lib/api'
import { getSetting, setSetting } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

const EMPTY = { rui_income: '', ana_income: '', joint_income: '', rui_conj: '', ana_conj: '' }

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  // Only plain string/number values; nothing nested is stored.
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(b)) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue
    if (typeof v === 'string' || typeof v === 'number') clean[k] = String(v).slice(0, 20)
  }
  await setSetting(user.householdId, 'budgets', JSON.stringify(clean))
  return NextResponse.json({ success: true })
})

export const GET = withAuth(async (_req: NextRequest, _ctx, user) => {
  const raw = await getSetting(user.householdId, 'budgets')
  if (!raw) return NextResponse.json(EMPTY)
  try {
    return NextResponse.json({ ...EMPTY, ...JSON.parse(raw) })
  } catch {
    return NextResponse.json(EMPTY)
  }
})
