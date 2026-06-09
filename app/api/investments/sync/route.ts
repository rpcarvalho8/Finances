import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET() {
  try {
    const r=await db.execute(`SELECT platform, CASE WHEN api_key IS NOT NULL AND api_key!='' THEN 'ok' ELSE 'inactive' END as status FROM api_keys`)
    const s:Record<string,string>={}; r.rows.forEach((row:any)=>{s[row.platform]=row.status}); return NextResponse.json(s)
  } catch { return NextResponse.json({}) }
}