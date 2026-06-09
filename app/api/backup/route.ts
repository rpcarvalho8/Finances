import { NextResponse } from 'next/server'
import fs from 'fs'; import path from 'path'
export async function GET() {
  try {
    const dbPath=(process.env.DATABASE_URL||'file:./data/finance.db').replace('file:','')
    const buf=fs.readFileSync(path.resolve(dbPath))
    const date=new Date().toISOString().slice(0,10)
    return new NextResponse(buf,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="finance-backup-${date}.db"`}})
  } catch(e:any) { return NextResponse.json({error:String(e)},{status:500}) }
}