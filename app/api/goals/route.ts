import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'
export const GET = withAuth(async (req: NextRequest) => {
  const owner=new URL(req.url).searchParams.get('owner')
  const r=await db.execute({sql:`SELECT * FROM goals WHERE active=1 ${owner?"AND (owner=? OR owner='familia')":''}  ORDER BY name`,args:owner?[owner]:[]})
  return NextResponse.json(r.rows)
})
export const POST = withAuth(async (req: NextRequest) => {
  const b=await req.json()
  const r=await db.execute({sql:`INSERT INTO goals (name,icon,target,saved,owner,color) VALUES (?,?,?,?,?,?)`,args:[b.name,b.icon||'🎯',b.target,b.saved||0,b.owner||'rui',b.color||'#c8f97e']})
  return NextResponse.json({id:r.lastInsertRowid,success:true})
})