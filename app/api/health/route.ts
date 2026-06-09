import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET() {
  try { await db.execute('SELECT 1'); return NextResponse.json({status:'ok',ts:new Date().toISOString()}) }
  catch(e:any) { return NextResponse.json({status:'error',msg:String(e)},{status:500}) }
}