import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth/guard'
export const DELETE = withAuth(async (_:NextRequest,{params}:{params:{id:string}}) => {
  await db.execute({sql:`DELETE FROM lumeu_expenses WHERE id=?`,args:[params.id]})
  return NextResponse.json({success:true})
})