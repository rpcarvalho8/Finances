import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, ledgerErrorResponse, optionalString, readJsonObject } from '@/lib/api'
import { ACCOUNT_KINDS, createAccount, listAccounts, resolveView, type AccountKind } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (_req: NextRequest, _ctx, user) => NextResponse.json(await listAccounts(user.householdId)))

/** { name, kind, owner: member slug | 'conjunta', institution? } */
export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const b = await readJsonObject(req)
  if (!b) return badRequest('Pedido inválido')
  const name = optionalString(b.name, 80)
  if (!name) return badRequest('Nome inválido')
  if (typeof b.kind !== 'string' || !(ACCOUNT_KINDS as readonly string[]).includes(b.kind)) return badRequest('Tipo de conta inválido')
  const view = await resolveView(user.householdId, typeof b.owner === 'string' ? b.owner : user.slug)
  if (!view) return badRequest('Pessoa desconhecida')
  const institution = optionalString(b.institution, 40)
  if (institution === null) return badRequest('Instituição inválida')
  try {
    const id = await createAccount(user.householdId, { view, name, kind: b.kind as AccountKind, institution })
    return NextResponse.json({ id, success: true })
  } catch (err) {
    return ledgerErrorResponse(err)
  }
})
