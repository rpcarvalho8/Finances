'use client'
import { useState, useEffect, useCallback } from 'react'
import { StatCard, Card, SectionTitle, CategoryBar, TxnRow, GoalBar, PageHeader, AddTransactionForm, ImportCSV, fmt } from '@/components/UI'

const INCOME = 1159.30
const CATS = [
  {name:'Necessidades Básicas',icon:'🏠',color:'#7eb8f9',pct:.50},
  {name:'Liberdade Financeira',icon:'📈',color:'#6ef9a8',pct:.13},
  {name:'Lazer',icon:'🎭',color:'#a07ef9',pct:.12},
  {name:'Despesas Carro',icon:'🚗',color:'#f9c67e',pct:.10},
  {name:'Fundo de Emergência',icon:'🛡️',color:'#f97ec8',pct:.10},
  {name:'Despesas Educação',icon:'📚',color:'#f9f97e',pct:.05},
  {name:'Investimentos',icon:'📈',color:'#6ef9a8',pct:0},
  {name:'Poupança',icon:'💰',color:'#5ef0d8',pct:0},
  {name:'Transportes',icon:'🚗',color:'#f9c67e',pct:0},
  {name:'Saúde',icon:'❤️',color:'#f97ec8',pct:0},
  {name:'LUMEU',icon:'🏢',color:'#ff9f43',pct:0},
  {name:'Compras',icon:'🛍️',color:'#f96e6e',pct:0},
  {name:'Outros',icon:'📦',color:'#666',pct:0},
]
const MONTHS = [{key:'all',label:'Todos'},{key:'2026-01',label:'Jan'},{key:'2026-02',label:'Fev'},{key:'2026-03',label:'Mar'}]

export default function RuiPage() {
  const [txns,setTxns]=useState<any[]>([])
  const [goals,setGoals]=useState<any[]>([])
  const [month,setMonth]=useState('all')
  const [loading,setLoading]=useState(true)

  const load = useCallback(async()=>{
    setLoading(true)
    const url = month==='all'?'/api/transactions?owner=rui&limit=200':`/api/transactions?owner=rui&month=${month}&limit=200`

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
      fetchSafely('/api/goals?owner=rui')
    ])

    setTxns(Array.isArray(t) ? t : [])
    setGoals(Array.isArray(g) ? g : [])
    setLoading(false)
  },[month])

  useEffect(()=>{load()},[load])

  const income=txns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
  const expenses=txns.filter(t=>t.amount<0&&t.category_name!=='LUMEU').reduce((s,t)=>s+Math.abs(t.amount),0)
  const invested=txns.filter(t=>t.type==='investment').reduce((s,t)=>s+Math.abs(t.amount),0)
  const lumeu=txns.filter(t=>t.category_name==='LUMEU').reduce((s,t)=>s+Math.abs(t.amount),0)

  const catTotals:Record<string,number>={}
  txns.filter(t=>t.amount<0).forEach(t=>{const c=t.category_name||'Outros';catTotals[c]=(catTotals[c]||0)+Math.abs(t.amount)})

  async function del(id:number){if(!confirm('Apagar?'))return;await fetch(`/api/transactions/${id}`,{method:'DELETE'});load()}

  const btnStyle=(active:boolean):React.CSSProperties=>({padding:'5px 14px',borderRadius:'100px',cursor:'pointer',fontSize:'12px',fontWeight:500,border:'1px solid var(--bd)',background:active?'var(--rui)':'var(--surface)',color:active?'#0c0c0f':'var(--t2)',transition:'all .15s'})

  return (
    <div className="fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
        <PageHeader title="Rui —" italic="Conta Pessoal" sub="Activobank · 2026" accent="var(--rui)"/>
        <ImportCSV owner="rui"/>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'18px'}}>
        {MONTHS.map(m=><button key={m.key} onClick={()=>setMonth(m.key)} style={btnStyle(month===m.key)}>{m.label}</button>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'18px'}}>
        <StatCard label="Receita" value={fmt(income)} sub="salário + entradas" color="var(--green)" pin="var(--green)"/>
        <StatCard label="Despesas" value={fmt(expenses)} sub="excl. LUMEU" color="var(--red)" pin="var(--red)"/>
        <StatCard label="Investido" value={fmt(invested)} sub="XTB+IBKR+Bybit+PPR" color="var(--accent)" pin="var(--accent)"/>
        <StatCard label="LUMEU" value={fmt(lumeu)} sub="negócio" color="var(--lumeu)" pin="var(--lumeu)"/>
      </div>
      <div style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',padding:'10px 16px',marginBottom:'18px',display:'flex',gap:'20px',flexWrap:'wrap',fontSize:'12px'}}>
        {[{l:'Salário bruto',v:'1.509,30 €',c:'var(--rui)'},{l:'→ Conta conjunta',v:'350,00 €',c:'var(--amber)'},{l:'→ Conta pessoal',v:'1.159,30 €',c:'var(--green)'},{l:'Saldo atual',v:'156,24 €',c:'var(--t2)'}].map(item=>(
          <div key={item.l}><div style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.06em'}}>{item.l}</div><div style={{fontFamily:'var(--fm)',fontWeight:500,color:item.c}}>{item.v}</div></div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <SectionTitle right={`base: ${fmt(INCOME)}/mês`}>Orçamento</SectionTitle>
            {loading?<div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {CATS.filter(c=>catTotals[c.name]||c.pct>0).map(c=>(
                  <CategoryBar key={c.name} name={c.name} icon={c.icon} spent={catTotals[c.name]||0} budget={c.pct>0?INCOME*c.pct:0} color={c.color} percent={Math.round((catTotals[c.name]||0)/INCOME*100)}/>
                ))}
              </div>
            )}
          </Card>
          <Card><SectionTitle>+ Adicionar transação</SectionTitle><AddTransactionForm owner="rui" onAdd={load}/></Card>
          <Card>
            <SectionTitle right={`${txns.length} transações`}>Movimentos</SectionTitle>
            {txns.map((t:any)=>(<TxnRow key={t.id} date={t.date} description={t.description} category={t.category_name||'Outros'} amount={t.amount} icon={t.icon} onDelete={()=>del(t.id)}/>))}
          </Card>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card><SectionTitle>Metas</SectionTitle>{goals.map((g:any)=>(<GoalBar key={g.id} name={g.name} saved={g.saved} target={g.target} color={g.color||'var(--rui)'}/>))}</Card>
          {lumeu>0&&<Card style={{borderTop:'2px solid var(--lumeu)'}}><SectionTitle>🏢 LUMEU</SectionTitle><div style={{fontFamily:'var(--fm)',fontSize:'22px',color:'var(--lumeu)'}}>{fmt(lumeu)}</div><div style={{fontSize:'11px',color:'var(--m)',marginTop:'4px'}}>{txns.filter(t=>t.category_name==='LUMEU').length} faturas Emergent</div></Card>}
        </div>
      </div>
    </div>
  )
}