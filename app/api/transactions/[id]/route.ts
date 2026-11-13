import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'
export const PUT = withAuth(async (req: NextRequest,{params}:{params:{id:string}}) => {
  const b=await req.json()
  await db.execute({sql:`UPDATE transactions SET date=COALESCE(?,date),description=COALESCE(?,description),amount=COALESCE(?,amount),updated_at=datetime('now') WHERE id=?`,args:[b.date??null,b.description??null,b.amount??null,params.id]})
  return NextResponse.json({success:true})
})
export const DELETE = withAuth(async (_:NextRequest,{params}:{params:{id:string}}) => {
  await db.execute({sql:`DELETE FROM transactions WHERE id=?`,args:[params.id]})
  return NextResponse.json({success:true})
})