'use client'
import { useState, useEffect, useCallback } from 'react'
import { StatCard, Card, SectionTitle, CategoryBar, TxnRow, GoalBar, PageHeader, AddTransactionForm, ImportCSV, fmt } from '@/components/UI'
import { useBudgets } from '@/lib/useBudgets'

const CATS = [
  {name:'Necessidades Básicas',icon:'🏠',color:'#f97ec8',pct:.55},
  {name:'Lazer',icon:'🎭',color:'#a07ef9',pct:.15},
  {name:'Despesas Carro',icon:'🚗',color:'#f9c67e',pct:.10},
  {name:'Fundo de Emergência',icon:'🛡️',color:'#6ef9a8',pct:.08},
  {name:'Liberdade Financeira',icon:'📈',color:'#7eb8f9',pct:.07},
  {name:'Despesas Educação',icon:'📚',color:'#f9f97e',pct:.05},
  {name:'Poupança',icon:'💰',color:'#5ef0d8',pct:0},
  {name:'Saúde',icon:'❤️',color:'#f97ec8',pct:0},
  {name:'Outros',icon:'📦',color:'#666',pct:0},
]
const MONTHS = [{key:'all',label:'Todos'},{key:'2026-01',label:'Jan'},{key:'2026-02',label:'Fev'},{key:'2026-03',label:'Mar'}]

export default function AnaPage() {
  const [txns,setTxns]=useState<any[]>([])
  const [goals,setGoals]=useState<any[]>([])
  const [month,setMonth]=useState('all')
  const [loading,setLoading]=useState(true)
  const { ana_income: INCOME } = useBudgets()

  const load=useCallback(async()=>{
    setLoading(true)
    const url=month==='all'?'/api/transactions?owner=ana&limit=200':`/api/transactions?owner=ana&month=${month}&limit=200`

    const fetchSafely = async (fetchUrl: string) => {
      try {
        const res = await fetch(fetchUrl)
        if (!res.ok) return []
        return await res.json()
      } catch (err) {
        console.error('Fetch error:', err)
        return []
      }
    }

    const [t, g] = await Promise.all([
      fetchSafely(url),
      fetchSafely('/api/goals?owner=ana')
    ])

    setTxns(Array.isArray(t) ? t : [])
    setGoals(Array.isArray(g) ? g : [])
    setLoading(false)
  },[month])

  useEffect(()=>{load()},[load])

  const income=txns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
  const expenses=txns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)
  const catTotals:Record<string,number>={}
  txns.filter(t=>t.amount<0).forEach(t=>{const c=t.category_name||'Outros';catTotals[c]=(catTotals[c]||0)+Math.abs(t.amount)})
  async function del(id:number){if(!confirm('Apagar?'))return;await fetch(`/api/transactions/${id}`,{method:'DELETE'});load()}
  const btn=(a:boolean):React.CSSProperties=>({padding:'5px 14px',borderRadius:'100px',cursor:'pointer',fontSize:'12px',fontWeight:500,border:'1px solid var(--bd)',background:a?'var(--ana)':'var(--surface)',color:a?'#0c0c0f':'var(--t2)',transition:'all .15s'})

  return (
    <div className="fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
        <PageHeader title="Ana —" italic="Conta Pessoal" sub="ActivoBank · 2026" accent="var(--ana)"/>
        <ImportCSV owner="ana"/>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'18px'}}>
        {MONTHS.map(m=><button key={m.key} onClick={()=>setMonth(m.key)} style={btn(month===m.key)}>{m.label}</button>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'18px'}}>
        <StatCard label="Receita pessoal" value={fmt(income)} sub="após contrib. conjunta" color="var(--green)" pin="var(--green)"/>
        <StatCard label="Despesas" value={fmt(expenses)} sub="este período" color="var(--red)" pin="var(--red)"/>
        <StatCard label="Disponível" value={fmt(income-expenses)} sub="saldo" color="var(--ana)" pin="var(--ana)"/>
        <StatCard label="Metas" value={String(goals.length)} sub="ativas" color="var(--teal)" pin="var(--teal)"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <SectionTitle right={INCOME>0?`base: ${fmt(INCOME)}/mês`:'base: definir em Definições'}>Orçamento</SectionTitle>
            {loading?<div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {CATS.filter(c=>catTotals[c.name]||c.pct>0).map(c=>(
                  <CategoryBar key={c.name} name={c.name} icon={c.icon} spent={catTotals[c.name]||0} budget={c.pct>0?INCOME*c.pct:0} color={c.color} percent={Math.round((catTotals[c.name]||0)/Math.max(INCOME,1)*100)}/>
                ))}
                {Object.keys(catTotals).length===0&&<div style={{color:'var(--m)',fontSize:'12px',textAlign:'center',padding:'20px'}}>Sem transações. Importa o extrato CSV.</div>}
              </div>
            )}
          </Card>
          <Card><SectionTitle>+ Adicionar transação</SectionTitle><AddTransactionForm owner="ana" onAdd={load}/></Card>
          <Card>
            <SectionTitle right={`${txns.length} transações`}>Movimentos</SectionTitle>
            {txns.length===0&&!loading?<div style={{color:'var(--m)',fontSize:'12px',textAlign:'center',padding:'24px'}}>📭 Sem transações. Importa um extrato CSV.</div>:(
              txns.map((t:any)=>(<TxnRow key={t.id} date={t.date} description={t.description} category={t.category_name||'Outros'} amount={t.amount} icon={t.icon} onDelete={()=>del(t.id)}/>))
            )}
          </Card>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card><SectionTitle>Metas — Ana</SectionTitle>{goals.length===0?<div style={{color:'var(--m)',fontSize:'12px'}}>Sem metas definidas</div>:goals.map((g:any)=>(<GoalBar key={g.id} name={g.name} saved={g.saved} target={g.target} color={g.color||'var(--ana)'}/>))}</Card>
        </div>
      </div>
    </div>
  )
}