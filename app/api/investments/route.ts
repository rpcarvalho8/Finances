import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async () => {
  const r=await db.execute(`SELECT * FROM investments ORDER BY invested DESC`)
  return NextResponse.json(r.rows)
})
export const POST = withAuth(async (req: NextRequest) => {
  const b=await req.json()
  const r=await db.execute({sql:`INSERT INTO investments (platform,type,name,invested,current_value,owner,last_updated) VALUES (?,?,?,?,?,?,datetime('now'))`,args:[b.platform,b.type||'other',b.name||b.platform,b.invested||0,b.current_value||0,b.owner||'rui']})
  return NextResponse.json({id:r.lastInsertRowid,success:true})
})