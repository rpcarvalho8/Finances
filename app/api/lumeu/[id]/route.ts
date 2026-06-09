import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function DELETE(_:NextRequest,{params}:{params:{id:string}}) {
  await db.execute({sql:`DELETE FROM lumeu_expenses WHERE id=?`,args:[params.id]})
  return NextResponse.json({success:true})
}