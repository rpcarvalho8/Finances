import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'
export const PUT = withAuth(async (req: NextRequest,{params}:{params:{id:string}}) => {
  const b=await req.json()
  await db.execute({sql:`UPDATE goals SET saved=COALESCE(?,saved),target=COALESCE(?,target),name=COALESCE(?,name) WHERE id=?`,args:[b.saved??null,b.target??null,b.name??null,params.id]})
  return NextResponse.json({success:true})
})
export const DELETE = withAuth(async (_:NextRequest,{params}:{params:{id:string}}) => {
  await db.execute({sql:`UPDATE goals SET active=0 WHERE id=?`,args:[params.id]})
  return NextResponse.json({success:true})
})