import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (req: NextRequest) => {
  const body=await req.json()
  await db.execute({sql:`INSERT INTO api_keys (platform,extra) VALUES ('__budgets__',?) ON CONFLICT(platform) DO UPDATE SET extra=excluded.extra`,args:[JSON.stringify(body)]})
  return NextResponse.json({success:true})
})
export const GET = withAuth(async () => {
  const r=await db.execute(`SELECT extra FROM api_keys WHERE platform='__budgets__'`)
  if(r.rows.length>0&&r.rows[0].extra) return NextResponse.json(JSON.parse(r.rows[0].extra as string))
  return NextResponse.json({rui_income:'',ana_income:'',joint_income:'',rui_conj:'',ana_conj:''})
})