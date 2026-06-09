import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function POST(req: NextRequest) {
  const {platform,api_key,api_secret,...extra}=await req.json()
  await db.execute({sql:`INSERT INTO api_keys (platform,api_key,api_secret,extra) VALUES (?,?,?,?) ON CONFLICT(platform) DO UPDATE SET api_key=excluded.api_key,api_secret=excluded.api_secret,extra=excluded.extra`,args:[platform,api_key||null,api_secret||null,Object.keys(extra).length?JSON.stringify(extra):null]})
  return NextResponse.json({success:true})
}