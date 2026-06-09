import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function PUT(req: NextRequest,{params}:{params:{id:string}}) {
  const b=await req.json()
  await db.execute({sql:`UPDATE investments SET current_value=COALESCE(?,current_value),invested=COALESCE(?,invested),last_updated=datetime('now') WHERE id=?`,args:[b.current_value??null,b.invested??null,params.id]})
  return NextResponse.json({success:true})
}
export async function DELETE(_:NextRequest,{params}:{params:{id:string}}) {
  await db.execute({sql:`DELETE FROM investments WHERE id=?`,args:[params.id]})
  return NextResponse.json({success:true})
}