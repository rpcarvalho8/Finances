export const dynamic = 'force-dynamic'

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/auth/server'
import { listGoals, listMovements, listViews } from '@/lib/ledger'
import { centsToEuros, parseAmountToCents, sumCents } from '@/lib/money'
import Link from 'next/link'

function fmt(v: number): string {
  return Math.abs(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'
}

const VIEW_COLORS = ['#7eb8f9', '#f97ec8', '#a07ef9', '#6ef9a8']

async function getData(householdId: number) {
  const month = new Date().toISOString().slice(0, 7)
  const [txns, investments, goals, views] = await Promise.all([
    listMovements(householdId, { month, limit: 1000 }),
    getDb().execute({ sql: `SELECT id, platform, type, invested, current_value FROM investments WHERE household_id = ?`, args: [householdId] }),
    listGoals(householdId, null),
    listViews(householdId),
  ])
  return { txns, investments: investments.rows as any[], goals, views, month }
}

/** Income/expense totals in cents for one view key (or all when key is null). Transfers are excluded. */
function totals(txns: Awaited<ReturnType<typeof listMovements>>, key: string | null) {
  const rows = txns.filter((t) => (key === null || t.owner === key) && t.type !== 'transfer')
  return {
    inc: sumCents(rows.filter((t) => t.amount_cents > 0).map((t) => t.amount_cents)),
    out: sumCents(rows.filter((t) => t.amount_cents < 0).map((t) => -t.amount_cents)),
  }
}

export default async function DashboardPage() {
  const user = await requireUser()
  const { txns, investments, goals, views, month } = await getData(user.householdId)
  const all = totals(txns, null)
  const income = centsToEuros(all.inc)
  const expenses = centsToEuros(all.out)
  const invCents = (k: string) => sumCents(investments.map((i) => parseAmountToCents(Number(i[k] ?? 0)) ?? 0))
  const totalInv = centsToEuros(invCents('invested'))
  const totalCur = centsToEuros(invCents('current_value'))
  const pl = totalCur - totalInv
  const monthLabel = new Date(month+'-01').toLocaleDateString('pt-PT',{month:'long',year:'numeric'})

  const sc = (label:string,value:string,sub:string,color:string) => (
    <div style={{background:'#131318',border:'1px solid #2a2a38',borderRadius:'16px',padding:'16px 18px',position:'relative',overflow:'hidden'}}>
      <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.08em',color:'#606078',marginBottom:'6px'}}>{label}</div>
      <div style={{fontFamily:'DM Mono,monospace',fontSize:'20px',fontWeight:500,color,lineHeight:1}}>{value}</div>
      <div style={{fontSize:'11px',color:'#606078',marginTop:'4px'}}>{sub}</div>
    </div>
  )

  const people = views.map((v, i) => {
    const t = totals(txns, v.key)
    return { href: `/${v.key}`, label: v.name, color: v.key === 'conjunta' ? '#f9c67e' : VIEW_COLORS[i % VIEW_COLORS.length], inc: centsToEuros(t.inc), out: centsToEuros(t.out) }
  })

  return (
    <div style={{animation:'fadeUp .4s ease'}}>
      <div style={{marginBottom:'28px'}}>
        <h1 style={{fontFamily:'DM Serif Display,serif',fontSize:'32px',fontWeight:400,lineHeight:1.1}}>
          Finanças <em style={{fontStyle:'italic',color:'#c8f97e'}}>Familiares</em>
        </h1>
        <p style={{color:'#606078',fontSize:'12px',marginTop:'4px'}}>Visão consolidada · {monthLabel}</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
        {sc('Receita familiar',fmt(income),'todas as contas','#6ef9a8')}
        {sc('Despesas',fmt(expenses),'total saídas','#f96e6e')}
        {sc('Portfolio',fmt(totalCur),`P&L: ${pl>=0?'+':''}${fmt(pl)}`,'#c8f97e')}
        {sc('Saldo',fmt(income-expenses),`${Math.round((income-expenses)/Math.max(income,1)*100)}% da receita`,'#5ef0d8')}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'24px'}}>
        {people.map(p=>(
          <Link key={p.href} href={p.href} style={{textDecoration:'none'}}>
            <div style={{background:'#131318',border:'1px solid #2a2a38',borderTop:`2px solid ${p.color}`,borderRadius:'16px',padding:'20px',cursor:'pointer'}}>
              <div style={{fontWeight:600,fontSize:'13px',marginBottom:'12px',color:p.color}}>{p.label}</div>
              {[{l:'Receita',v:fmt(p.inc),c:'#6ef9a8'},{l:'Despesas',v:fmt(p.out),c:'#f96e6e'},{l:'Saldo',v:fmt(p.inc-p.out),c:(p.inc-p.out)>=0?'#6ef9a8':'#f96e6e'}].map(r=>(
                <div key={r.l} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginTop:'4px'}}>
                  <span style={{color:'#606078'}}>{r.l}</span>
                  <span style={{fontFamily:'DM Mono,monospace',color:r.c}}>{r.v}</span>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <div style={{background:'#131318',border:'1px solid #2a2a38',borderRadius:'16px',padding:'20px'}}>
            <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'#606078',marginBottom:'14px',display:'flex',justifyContent:'space-between'}}>
              Portfolio <Link href="/investimentos" style={{color:'#7eb8f9',textDecoration:'none',fontSize:'11px',fontStyle:'italic',textTransform:'none',letterSpacing:0}}>ver tudo →</Link>
            </div>
            {investments.map((inv:any)=>{
              const ipl=(inv.current_value||0)-(inv.invested||0)
              return (
                <div key={inv.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #2a2a38'}}>
                  <div><div style={{fontSize:'12px',fontWeight:500}}>{inv.platform}</div><div style={{fontSize:'10px',color:'#606078'}}>{inv.type}</div></div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:'12px'}}>{fmt(inv.current_value||0)}</div>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:'10px',color:ipl>=0?'#6ef9a8':'#f96e6e'}}>{ipl>=0?'+':''}{fmt(ipl)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{background:'#131318',border:'1px solid #2a2a38',borderRadius:'16px',padding:'20px'}}>
            <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'#606078',marginBottom:'14px',display:'flex',justifyContent:'space-between'}}>
              Últimas transações <span style={{fontStyle:'italic',textTransform:'none',letterSpacing:0,fontSize:'11px'}}>{txns.length} este mês</span>
            </div>
            {txns.slice(0,10).map((t:any)=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #2a2a38',gap:'10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'9px',flex:1,minWidth:0}}>
                  <div style={{width:'28px',height:'28px',borderRadius:'6px',background:'#1a1a22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:0}}>{t.icon||(t.amount>0?'💵':'💳')}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'12px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</div>
                    <div style={{fontSize:'10px',color:'#606078'}}>{t.category_name||'Outros'} · {t.owner}</div>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:'12px',color:t.amount>0?'#6ef9a8':'#f96e6e'}}>{t.amount>0?'+':'-'}{fmt(Math.abs(t.amount))}</div>
                  <div style={{fontSize:'10px',color:'#606078'}}>{t.date?.slice(5).replace('-','/')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:'#131318',border:'1px solid #2a2a38',borderRadius:'16px',padding:'20px'}}>
          <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'#606078',marginBottom:'14px'}}>Metas de poupança</div>
          {goals.map((g:any)=>{
            const pct=Math.min(Math.round(g.saved/g.target*100),100)
            return (
              <div key={g.id} style={{padding:'10px 0',borderBottom:'1px solid #2a2a38'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                  <div style={{fontSize:'12px',fontWeight:500}}>{g.name}</div>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:'11px',color:g.color||'#c8f97e'}}>{pct}%</div>
                </div>
                <div style={{height:'4px',background:'#222230',borderRadius:'100px',overflow:'hidden',marginBottom:'4px'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:g.color||'#c8f97e',borderRadius:'100px'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#606078'}}>
                  <span>{fmt(g.saved)} / {fmt(g.target)}</span>
                  <span>falta {fmt(g.target-g.saved)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
