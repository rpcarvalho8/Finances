import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (_req, _ctx, user) =>
  NextResponse.json({ name: user.name, email: user.email, role: user.role }),
)
