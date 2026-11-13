'use client'
import { useState, useEffect, useCallback } from 'react'
import { StatCard, Card, SectionTitle, CategoryBar, TxnRow, GoalBar, PageHeader, AddTransactionForm, ImportCSV, fmt } from '@/components/UI'
import { useBudgets } from '@/lib/useBudgets'

const CATS = [
  {name:'Habitação',icon:'🏠',color:'#7eb8f9',pct:.60},
  {name:'Alimentação',icon:'🛒',color:'#c8f97e',pct:.20},
  {name:'Utilidades',icon:'💡',color:'#f9c67e',pct:.12},
  {name:'Lazer',icon:'🎭',color:'#a07ef9',pct:.08},
  {name:'Outros',icon:'📦',color:'#666',pct:0},
  {name:'Transferências',icon:'↔️',color:'#888',pct:0},
]
const MONTHS = [{key:'all',label:'Todos'},{key:'2026-01',label:'Jan'},{key:'2026-02',label:'Fev'},{key:'2026-03',label:'Mar'}]

export default function ConjuntaPage() {
  const [txns,setTxns]=useState<any[]>([])
  const [goals,setGoals]=useState<any[]>([])
  const [month,setMonth]=useState('all')
  const [loading,setLoading]=useState(true)
  const { joint_income: INCOME } = useBudgets()

  const load=useCallback(async()=>{
    setLoading(true)
    const url=month==='all'?'/api/transactions?owner=conjunta&limit=200':`/api/transactions?owner=conjunta&month=${month}&limit=200`
    const fetchJson = async (input: RequestInfo) => {
      const res = await fetch(input)
      if (!res.ok) {
        // Return empty array on error
        return []
      }
      return res.json()
    }
    const [t,g]=await Promise.all([fetchJson(url), fetchJson('/api/goals?owner=familia')])
    setTxns(t);setGoals(g);setLoading(false)
  },[month])

  useEffect(()=>{load()},[load])

  const income=txns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
  const expenses=txns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)
  const hab=txns.filter(t=>t.category_name==='Habitação'&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)
  const alim=txns.filter(t=>t.category_name==='Alimentação'&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)
  const catTotals:Record<string,number>={}
  txns.filter(t=>t.amount<0).forEach(t=>{const c=t.category_name||'Outros';catTotals[c]=(catTotals[c]||0)+Math.abs(t.amount)})
  async function del(id:number){if(!confirm('Apagar?'))return;await fetch(`/api/transactions/${id}`,{method:'DELETE'});load()}
  const btn=(a:boolean):React.CSSProperties=>({padding:'5px 14px',borderRadius:'100px',cursor:'pointer',fontSize:'12px',fontWeight:500,border:'1px solid var(--bd)',background:a?'var(--conjunta)':'var(--surface)',color:a?'#0c0c0f':'var(--t2)',transition:'all .15s'})

  return (
    <div className="fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
        <PageHeader title="Conta" italic="Conjunta" sub="Abanca · Rui + Ana · 2026" accent="var(--conjunta)"/>
        <ImportCSV owner="conjunta"/>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'18px'}}>
        {MONTHS.map(m=><button key={m.key} onClick={()=>setMonth(m.key)} style={btn(month===m.key)}>{m.label}</button>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'18px'}}>
        <StatCard label="Entradas" value={fmt(income)} sub="todas as entradas" color="var(--green)" pin="var(--green)"/>
        <StatCard label="Saídas" value={fmt(expenses)} sub="total despesas" color="var(--red)" pin="var(--red)"/>
        <StatCard label="Habitação" value={fmt(hab)} sub="maior rubrica" color="var(--blue)" pin="var(--blue)"/>
        <StatCard label="Alimentação" value={fmt(alim)} sub="supermercados" color="var(--accent)" pin="var(--accent)"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <SectionTitle right={INCOME>0?`base: ${fmt(INCOME)}/mês`:'base: definir em Definições'}>Categorias</SectionTitle>
            {loading?<div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {CATS.filter(c=>catTotals[c.name]).map(c=>(
                  <CategoryBar key={c.name} name={c.name} icon={c.icon} spent={catTotals[c.name]||0} budget={c.pct>0?INCOME*c.pct:0} color={c.color} percent={Math.round((catTotals[c.name]||0)/Math.max(expenses,1)*100)}/>
                ))}
              </div>
            )}
          </Card>
          <Card><SectionTitle>+ Adicionar transação</SectionTitle><AddTransactionForm owner="conjunta" onAdd={load}/></Card>
          <Card>
            <SectionTitle right={`${txns.length} transações`}>Movimentos</SectionTitle>
            {txns.map((t:any)=>(<TxnRow key={t.id} date={t.date} description={t.description} category={t.category_name||'Outros'} amount={t.amount} icon={t.icon} onDelete={()=>del(t.id)}/>))}
          </Card>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card><SectionTitle>Metas familiares</SectionTitle>{goals.map((g:any)=>(<GoalBar key={g.id} name={g.name} saved={g.saved} target={g.target} color={g.color||'var(--conjunta)'}/>))}</Card>
        </div>
      </div>
    </div>
  )
}