import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function categorize(desc: string, amount: number): { category: string; type: string } {
  const d = desc.toUpperCase()
  if (amount > 0) return { category: 'Receita', type: 'income' }
  if (d.includes('EMERGENT')) return { category: 'LUMEU', type: 'expense' }
  if (d.includes('XTB') || d.includes('BYBIT') || d.includes('BINANCE') || d.includes('INTERACTIVE BROKERS') || d.includes('PPR')) return { category: 'Investimentos', type: 'investment' }
  if (d.includes('POUPEUP') || d.includes('DEP PRAZO') || d.includes('DEPOSITO')) return { category: 'Poupança', type: 'savings' }
  if (d.includes('AMORT') || d.includes('RENDA') || d.includes('CONDOMINIO') || d.includes('GARAGEM') || d.includes('ZURICH') || d.includes('SEGURO') || d.includes('VODAFONE') || d.includes('INDAQUA') || d.includes('AGUAS')) return { category: 'Habitação', type: 'expense' }
  if (['CONTINENTE','LIDL','MERCADONA','AUCHAN','PINGO DOCE','POUPA'].some(s => d.includes(s))) return { category: 'Alimentação', type: 'expense' }
  if (['REPSOL','GALP','BRISA','VIAVERDE','CRCPCOM'].some(s => d.includes(s))) return { category: 'Transportes', type: 'expense' }
  if (['RESTAURANT','CERVEJARIA','MCDONALD','CAFE','SUSHI','PLAYTOMIC','STAR ACADEMY'].some(s => d.includes(s))) return { category: 'Lazer', type: 'expense' }
  if (['CLINICO','FARMACIA','HOSPITAL'].some(s => d.includes(s))) return { category: 'Saúde', type: 'expense' }
  if (['GOOGLE','NOS ','SPOTIFY'].some(s => d.includes(s))) return { category: 'Necessidades Básicas', type: 'expense' }
  return { category: 'Outros', type: 'expense' }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const owner = formData.get('owner') as string
  if (!file || !owner) return NextResponse.json({ error: 'Ficheiro e owner obrigatórios' }, { status: 400 })

  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  let imported = 0, skipped = 0
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 4) continue
      const rawDate = cols[0]
      const dp = rawDate.split(/[-\/]/)
      if (dp.length < 3) continue
      const date = dp[2].length === 4 ? `${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}` : `${dp[0]}-${dp[1].padStart(2,'0')}-${dp[2].padStart(2,'0')}`
      const description = (cols[2] || cols[1]).trim()
      const amountStr = (cols[3] || '').replace(/\./g, '').replace(',', '.')
      const amount = parseFloat(amountStr)
      if (isNaN(amount) || !date || !description) continue

      const existing = await db.execute({ sql: `SELECT id FROM transactions WHERE date=? AND description=? AND amount=? AND owner=? LIMIT 1`, args: [date, description, amount, owner] })
      if (existing.rows.length > 0) { skipped++; continue }

      const { category, type } = categorize(description, amount)
      await db.execute({ sql: `INSERT INTO transactions (date,description,amount,type,owner,category_id,account_id) SELECT ?,?,?,?,?,c.id,a.id FROM categories c, accounts a WHERE c.name=? AND a.owner=? LIMIT 1`, args: [date, description, amount, type, owner, category, owner] })
      imported++
    } catch (e) { errors.push(`Linha ${i}: ${e}`) }
  }
  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 5) })
}