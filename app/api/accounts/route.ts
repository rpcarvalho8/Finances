import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { listAccounts } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (_req: NextRequest, _ctx, user) => NextResponse.json(await listAccounts(user.householdId)))
