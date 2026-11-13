import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async () => {
  const r=await db.execute(`SELECT * FROM lumeu_expenses ORDER BY date DESC`)
  return NextResponse.json(r.rows)
})
export const POST = withAuth(async (req: NextRequest) => {
  const b=await req.json()
  const r=await db.execute({sql:`INSERT INTO lumeu_expenses (date,description,amount,category,vendor,notes) VALUES (?,?,?,?,?,?)`,args:[b.date,b.description,b.amount,b.category||'infra',b.vendor||null,b.notes||null]})
  return NextResponse.json({id:r.lastInsertRowid,success:true})
})