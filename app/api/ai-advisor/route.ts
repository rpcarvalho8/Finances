import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { question } = await req.json()
  const month = new Date().toISOString().slice(0, 7)

  const [txns, investments, goals, lumeu] = await Promise.all([
    db.execute({ sql: `SELECT t.*,c.name as cat FROM transactions t LEFT JOIN categories c ON t.category_id=c.id WHERE t.date LIKE ? ORDER BY t.date DESC LIMIT 50`, args: [month + '%'] }),
    db.execute(`SELECT * FROM investments`),
    db.execute(`SELECT * FROM goals WHERE active=1`),
    db.execute(`SELECT * FROM lumeu_expenses ORDER BY date DESC LIMIT 20`),
  ])

  const income = (txns.rows as any[]).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const expenses = (txns.rows as any[]).filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalInvested = (investments.rows as any[]).reduce((s, i) => s + (i.invested || 0), 0)
  const totalCurrent = (investments.rows as any[]).reduce((s, i) => s + (i.current_value || 0), 0)
  const lumeuTotal = (lumeu.rows as any[]).reduce((s, e) => s + (e.amount || 0), 0)

  const system = `És um conselheiro financeiro pessoal para o Rui e a Ana, em Portugal. Responde sempre em português europeu. Sê direto, prático e usa os dados reais abaixo.

SITUAÇÃO FINANCEIRA (${month}):
Rui: salário 1.509€ → conta pessoal 1.159€ → conta conjunta 350€
Ana: salário 601€ → conta pessoal 301€ → conta conjunta 300€
Conta conjunta: 650€/mês

Este mês: Receita ${income.toFixed(0)}€ | Despesas ${expenses.toFixed(0)}€

PORTFOLIO:
${(investments.rows as any[]).map(i => `- ${i.platform}: investido ${i.invested}€, atual ${i.current_value}€`).join('\n')}
Total investido: ${totalInvested.toFixed(0)}€ | Valor atual: ${totalCurrent.toFixed(0)}€ | P&L: ${(totalCurrent - totalInvested).toFixed(0)}€

LUMEU (negócio): ${lumeuTotal.toFixed(0)}€ em custos (Emergent)

METAS:
${(goals.rows as any[]).map(g => `- ${g.name}: ${g.saved}€/${g.target}€ (${Math.round(g.saved/g.target*100)}%)`).join('\n')}

ÚLTIMAS TRANSAÇÕES:
${(txns.rows as any[]).slice(0, 12).map(t => `- ${t.date}: ${t.description} ${t.amount > 0 ? '+' : ''}${t.amount}€ (${t.cat})`).join('\n')}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: question || 'Analisa a minha situação financeira e dá-me os 3 principais conselhos.' }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ response: text })
}