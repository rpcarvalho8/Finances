import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET() {
  const r=await db.execute(`SELECT * FROM lumeu_expenses ORDER BY date DESC`)
  return NextResponse.json(r.rows)
}
export async function POST(req: NextRequest) {
  const b=await req.json()
  const r=await db.execute({sql:`INSERT INTO lumeu_expenses (date,description,amount,category,vendor,notes) VALUES (?,?,?,?,?,?)`,args:[b.date,b.description,b.amount,b.category||'infra',b.vendor||null,b.notes||null]})
  return NextResponse.json({id:r.lastInsertRowid,success:true})
}