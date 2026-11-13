import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, optionalString, readJsonObject } from '@/lib/api'
import { getDb } from '@/lib/db'
import { resolveView } from '@/lib/ledger'
import { centsToEuros, parseAmountToCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

// Legacy table (REAL euros) kept until B4/INV-001; scoped by household since A4b.
// Values are validated through parseAmountToCents and stored rounded to the cent.

export const GET = withAuth(async (_req: NextRequest, _ctx, user) => {
  const r = await getDb().execute({
    sql: `SELECT id, platform, type, name, invested, current_value, currency, owner, last_updated, notes FROM investments WHERE household_id = ? ORDER BY invested DESC`,
    args: [user.householdId],
  })
  return NextResponse.json(r.rows)
})

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const platform = optionalString(b.platform, 100)
  if (!platform) return badRequest('Plataforma em falta')
  const invested = parseAmountToCents(b.invested ?? 0)
  const current = parseAmountToCents(b.current_value ?? 0)
  if (invested === null || current === null) return badRequest('Montante inválido')
  const view = await resolveView(user.householdId, typeof b.owner === 'string' ? b.owner : user.slug)
  if (!view) return badRequest('Pessoa desconhecida')
  const r = await getDb().execute({
    sql: `INSERT INTO investments (household_id, platform, type, name, invested, current_value, owner, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [user.householdId, platform, optionalString(b.type, 30) || 'other', optionalString(b.name, 100) || platform, centsToEuros(invested), centsToEuros(current), view.key],
  })
  return NextResponse.json({ id: Number(r.lastInsertRowid), success: true })
})
