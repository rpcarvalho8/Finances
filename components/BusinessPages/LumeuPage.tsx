'use client'
import { useState, useEffect, useCallback } from 'react'
import { StatCard, Card, SectionTitle, PageHeader, fmt } from '@/components/UI'

const CAT_LABELS:Record<string,string> = {infra:'🖥️ Infraestrutura',marketing:'📣 Marketing',software:'💻 Software',outros:'📦 Outros'}

export default function LumeuPage() {
  const [expenses,setExpenses]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [addOpen,setAddOpen]=useState(false)
  const [form,setForm]=useState({date:new Date().toISOString().split('T')[0],description:'',amount:'',category:'infra',vendor:'',notes:''})

  const load=useCallback(async()=>{setLoading(true);const r=await fetch('/api/lumeu').then(r=>r.json());setExpenses(r);setLoading(false)},[])
  useEffect(()=>{load()},[load])

  const total=expenses.reduce((s,e)=>s+(e.amount||0),0)
  const byMonth:Record<string,number>={}
  const byCat:Record<string,number>={}
  expenses.forEach(e=>{const m=e.date?.slice(0,7)||'N/A';byMonth[m]=(byMonth[m]||0)+e.amount;byCat[e.category]=(byCat[e.category]||0)+e.amount})

  async function add(){
    await fetch('/api/lumeu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,amount:parseFloat(form.amount)})})
    setAddOpen(false);setForm(f=>({...f,description:'',amount:'',vendor:'',notes:''}));load()
  }
  async function del(id:number){if(!confirm('Apagar?'))return;await fetch(`/api/lumeu/${id}`,{method:'DELETE'});load()}

  const inp:React.CSSProperties={background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'7px 10px',outline:'none',width:'100%'}

  return (
    <div className="fade-up">
      <div style={{background:'linear-gradient(135deg,rgba(255,159,67,.1),rgba(255,159,67,.03))',border:'1px solid rgba(255,159,67,.25)',borderRadius:'var(--r)',padding:'20px 24px',marginBottom:'24px',display:'flex',alignItems:'center',gap:'20px'}}>
        <div>
          <div style={{fontFamily:'var(--fd)',fontSize:'36px',fontStyle:'italic',color:'var(--lumeu)',lineHeight:1}}>LUMEU</div>
          <div style={{fontSize:'12px',color:'var(--m)',marginTop:'4px'}}>Despesas do negócio · 2026</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:'24px'}}>
          <div><div style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>Total 2026</div><div style={{fontFamily:'var(--fm)',fontSize:'22px',color:'var(--lumeu)'}}>{fmt(total)}</div></div>
          <div><div style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>Faturas</div><div style={{fontFamily:'var(--fm)',fontSize:'22px',color:'var(--t)'}}>{expenses.length}</div></div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'24px'}}>
        {Object.entries(byMonth).sort().map(([m,v])=>{
          const label=new Date(m+'-01').toLocaleDateString('pt-PT',{month:'long',year:'2-digit'})
          return <StatCard key={m} label={label} value={fmt(v)} sub={`${expenses.filter(e=>e.date?.startsWith(m)).length} faturas`} color="var(--lumeu)" pin="var(--lumeu)"/>
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:'16px',alignItems:'start'}}>
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <SectionTitle>Timeline de despesas</SectionTitle>
            <button onClick={()=>setAddOpen(!addOpen)} style={{background:'var(--lumeu)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'6px 14px',cursor:'pointer'}}>+ Adicionar</button>
          </div>
          {addOpen&&(
            <div style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',padding:'14px',marginBottom:'16px'}}>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
                {[{k:'description',l:'Descrição',t:'text'},{k:'amount',l:'Valor (€)',t:'number'},{k:'date',l:'Data',t:'date'}].map(f=>(
                  <div key={f.k} style={{flex:f.k==='description'?2:1,minWidth:'100px',display:'flex',flexDirection:'column',gap:'3px'}}>
                    <label style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>{f.l}</label>
                    <input type={f.t} value={(form as any)[f.k]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} style={inp}/>
                  </div>
                ))}
                <div style={{flex:1,minWidth:'110px',display:'flex',flexDirection:'column',gap:'3px'}}>
                  <label style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>Categoria</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp}>
                    <option value="infra">Infraestrutura</option><option value="software">Software</option><option value="marketing">Marketing</option><option value="outros">Outros</option>
                  </select>
                </div>
                <div style={{flex:1,minWidth:'100px',display:'flex',flexDirection:'column',gap:'3px'}}>
                  <label style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>Fornecedor</label>
                  <input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="ex: Emergent" style={inp}/>
                </div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notas opcionais..." style={{...inp,flex:1}}/>
                <button onClick={add} style={{background:'var(--lumeu)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'7px 14px',cursor:'pointer'}}>Guardar</button>
              </div>
            </div>
          )}
          {loading?<div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>:expenses.length===0?<div style={{color:'var(--m)',fontSize:'12px',textAlign:'center',padding:'24px'}}>Sem despesas. Clica em "+ Adicionar".</div>:(
            expenses.sort((a,b)=>b.date?.localeCompare(a.date)).map((e:any)=>(
              <div key={e.id} style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'10px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{fontFamily:'var(--fm)',fontSize:'11px',color:'var(--m)',minWidth:'46px',paddingTop:'2px'}}>{e.date?.slice(5).replace('-','/')}</div>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'var(--lumeu)',marginTop:'4px',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:500}}>{e.description}</div>
                  <div style={{fontSize:'10px',color:'var(--m)'}}>{CAT_LABELS[e.category]||e.category}{e.vendor&&` · ${e.vendor}`}{e.notes&&` · ${e.notes}`}</div>
                </div>
                <div style={{fontFamily:'var(--fm)',fontSize:'12px',color:'var(--red)',fontWeight:500}}>-{fmt(e.amount)}</div>
                <button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'var(--m)',cursor:'pointer',fontSize:'11px',opacity:.4}}>✕</button>
              </div>
            ))
          )}
        </Card>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <SectionTitle>Por categoria</SectionTitle>
            {Object.entries(byCat).map(([cat,val])=>{
              const pct=Math.round(val/total*100)
              return (
                <div key={cat} style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'3px'}}><span>{CAT_LABELS[cat]||cat}</span><span style={{fontFamily:'var(--fm)',color:'var(--lumeu)'}}>{fmt(val)}</span></div>
                  <div style={{height:'3px',background:'var(--s2)',borderRadius:'100px',overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:'var(--lumeu)',borderRadius:'100px'}}/></div>
                </div>
              )
            })}
          </Card>
          <Card style={{borderTop:'2px solid var(--lumeu)'}}>
            <SectionTitle>Exportar para contabilidade</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--t2)',lineHeight:1.8,marginBottom:'12px'}}>Exporta todas as despesas LUMEU em CSV.</div>
            <button onClick={()=>{
              const csv=['Data,Descrição,Valor,Categoria,Fornecedor',...expenses.map(e=>`${e.date},"${e.description}",${e.amount},${e.category},${e.vendor||''}`)].join('\n')
              const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='lumeu-2026.csv';a.click()
            }} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontSize:'12px',padding:'8px 14px',cursor:'pointer',width:'100%'}}>📥 Exportar CSV</button>
          </Card>
        </div>
      </div>
    </div>
  )
}