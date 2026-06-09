import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const owner=p.get('owner'),month=p.get('month'),limit=parseInt(p.get('limit')||'100')
  let sql=`SELECT t.*,c.name as category_name,c.icon,c.color FROM transactions t LEFT JOIN categories c ON t.category_id=c.id WHERE 1=1`
  const args:any[]=[]
  if(owner){sql+=` AND t.owner=?`;args.push(owner)}
  if(month){sql+=` AND t.date LIKE ?`;args.push(month+'%')}
  sql+=` ORDER BY t.date DESC LIMIT ?`;args.push(limit)
  const r=await db.execute({sql,args})
  return NextResponse.json(r.rows)
}
export async function POST(req: NextRequest) {
  const b=await req.json()
  if(!b.date||!b.description||b.amount===undefined||!b.type||!b.owner) return NextResponse.json({error:'Campos em falta'},{status:400})
  const r=await db.execute({sql:`INSERT INTO transactions (date,description,amount,type,owner,category_id,notes,account_id) SELECT ?,?,?,?,?,c.id,?,a.id FROM accounts a LEFT JOIN categories c ON c.name=? WHERE a.owner=? LIMIT 1`,args:[b.date,b.description,b.amount,b.type,b.owner,b.notes||null,b.category||null,b.owner]})
  return NextResponse.json({id:r.lastInsertRowid,success:true})
}