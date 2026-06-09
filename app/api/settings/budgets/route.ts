import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function POST(req: NextRequest) {
  const body=await req.json()
  await db.execute({sql:`INSERT INTO api_keys (platform,extra) VALUES ('__budgets__',?) ON CONFLICT(platform) DO UPDATE SET extra=excluded.extra`,args:[JSON.stringify(body)]})
  return NextResponse.json({success:true})
}
export async function GET() {
  const r=await db.execute(`SELECT extra FROM api_keys WHERE platform='__budgets__'`)
  if(r.rows.length>0&&r.rows[0].extra) return NextResponse.json(JSON.parse(r.rows[0].extra as string))
  return NextResponse.json({rui_income:'1159.30',ana_income:'301.18',joint_income:'650.00',rui_conj:'350.00',ana_conj:'300.00'})
}