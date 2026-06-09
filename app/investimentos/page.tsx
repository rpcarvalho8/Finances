'use client'
import { useState, useEffect, useCallback } from 'react'
import { StatCard, Card, SectionTitle, PageHeader, fmt } from '@/components/UI'

const PLATS = [
  {key:'xtb',label:'XTB',color:'#7eb8f9',type:'Ações/ETF',docs:'https://developers.xtb.com/'},
  {key:'ibkr',label:'Interactive Brokers',color:'#5ef0d8',type:'Ações',docs:'https://interactivebrokers.github.io/tws-api/'},
  {key:'bybit',label:'Bybit EU',color:'#f9c67e',type:'Cripto',docs:'https://bybit-exchange.github.io/docs/'},
  {key:'binance',label:'Binance',color:'#f9c67e',type:'Cripto',docs:'https://binance-docs.github.io/apidocs/'},
  {key:'t212',label:'Trading212',color:'#6ef9a8',type:'Ações/ETF',docs:'https://t212public-api-docs.redoc.ly/'},
  {key:'ppr',label:'PPR (NB)',color:'#f97ec8',type:'PPR',docs:''},
  {key:'poupeup',label:'PoupeUp',color:'#6ef9a8',type:'Poupança',docs:''},
]

export default function InvestimentosPage() {
  const [investments,setInvestments]=useState<any[]>([])
  const [apiStatus,setApiStatus]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(true)
  const [addOpen,setAddOpen]=useState(false)
  const [form,setForm]=useState({platform:'XTB',type:'etf',name:'',invested:'',current_value:''})

  const fetchJson = async (input: RequestInfo, defaultValue: any) => {
    try {
      const res = await fetch(input)
      if (!res.ok) {
        return defaultValue
      }
      return await res.json()
    } catch {
      return defaultValue
    }
  }

  const load=useCallback(async()=>{
    setLoading(true)
    const inv = await fetchJson('/api/investments', [])
    const status = await fetchJson('/api/investments/sync', {})
    setInvestments(inv); setApiStatus(status); setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const totalInv=investments.reduce((s,i)=>s+(i.invested||0),0)
  const totalCur=investments.reduce((s,i)=>s+(i.current_value||0),0)
  const pl=totalCur-totalInv
  const plPct=totalInv>0?(pl/totalInv*100).toFixed(1):'0.0'

  async function addInv(){
    await fetch('/api/investments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,invested:parseFloat(form.invested),current_value:parseFloat(form.current_value),owner:'rui'})})
    setAddOpen(false);load()
  }
  async function updateVal(id:number,val:number){
    await fetch(`/api/investments/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_value:val})});load()
  }
  async function del(id:number){if(!confirm('Apagar?'))return;await fetch(`/api/investments/${id}`,{method:'DELETE'});load()}

  const inp:React.CSSProperties={background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'7px 10px',outline:'none',width:'100%'}

  return (
    <div className="fade-up">
      <PageHeader title="Portfolio de" italic="Investimentos" sub="XTB · IBKR · Bybit · Binance · T212 · PPR"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Total investido" value={fmt(totalInv)} sub="2026" color="var(--blue)" pin="var(--blue)"/>
        <StatCard label="Valor atual" value={fmt(totalCur)} sub="estimado" color="var(--accent)" pin="var(--accent)"/>
        <StatCard label="P&L total" value={`${pl>=0?'+':''}${fmt(pl)}`} sub={`${plPct}% retorno`} color={pl>=0?'var(--green)':'var(--red)'} pin={pl>=0?'var(--green)':'var(--red)'}/>
        <StatCard label="Plataformas" value={`${investments.length}`} sub="posições" color="var(--purple)" pin="var(--purple)"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
              <SectionTitle>Posições</SectionTitle>
              <button onClick={()=>setAddOpen(!addOpen)} style={{background:'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'6px 14px',cursor:'pointer'}}>+ Adicionar</button>
            </div>
            {addOpen&&(
              <div style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',padding:'14px',marginBottom:'16px'}}>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
                  {[{k:'platform',l:'Plataforma',el:'select'},{k:'name',l:'Nome/Ticker',el:'input'},{k:'invested',l:'Investido (€)',el:'number'},{k:'current_value',l:'Atual (€)',el:'number'}].map(f=>(
                    <div key={f.k} style={{flex:1,minWidth:'110px',display:'flex',flexDirection:'column',gap:'3px'}}>
                      <label style={{fontSize:'10px',color:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em'}}>{f.l}</label>
                      {f.el==='select'?<select value={(form as any)[f.k]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} style={inp}>{PLATS.map(p=><option key={p.key}>{p.label}</option>)}</select>:<input type={f.el==='number'?'number':'text'} value={(form as any)[f.k]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} placeholder={f.l} style={inp}/>}
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'flex-end'}}><button onClick={addInv} style={{background:'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'7px 14px',cursor:'pointer'}}>Guardar</button></div>
                </div>
              </div>
            )}
            {loading?<div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>:(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                <thead><tr>{['Plataforma','Tipo','Investido','Atual','P&L','Peso',''].map(h=><th key={h} style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)',padding:'0 8px 10px 0',textAlign:'left',borderBottom:'1px solid var(--bd)'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {investments.map((inv:any)=>{
                    const ipl=(inv.current_value||0)-(inv.invested||0)
                    const iplPct=inv.invested>0?(ipl/inv.invested*100).toFixed(1):'0.0'
                    const w=totalInv>0?Math.round(inv.invested/totalInv*100):0
                    const pc=PLATS.find(p=>p.label===inv.platform)?.color||'#888'
                    return (
                      <tr key={inv.id}>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:'100px',fontSize:'10px',fontWeight:600,background:`${pc}22`,color:pc}}>{inv.platform}</span></td>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)',color:'var(--m)',fontSize:'11px'}}>{inv.type}</td>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)',fontFamily:'var(--fm)'}}>{fmt(inv.invested||0)}</td>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)'}}><input type="number" defaultValue={inv.current_value} onBlur={e=>updateVal(inv.id,parseFloat(e.target.value))} style={{...inp,width:'90px',padding:'4px 7px',fontSize:'11px'}}/></td>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)',fontFamily:'var(--fm)',fontSize:'11px',fontWeight:500,color:ipl>=0?'var(--green)':'var(--red)'}}>{ipl>=0?'+':''}{fmt(ipl)}<br/><span style={{fontSize:'10px',opacity:.7}}>({iplPct}%)</span></td>
                        <td style={{padding:'10px 8px 10px 0',borderBottom:'1px solid var(--s2)'}}><div style={{height:'4px',width:'70px',background:'var(--s2)',borderRadius:'100px',overflow:'hidden'}}><div style={{height:'100%',width:`${w}%`,background:pc,borderRadius:'100px'}}/></div><span style={{fontSize:'10px',color:'var(--m)'}}>{w}%</span></td>
                        <td style={{padding:'10px 0',borderBottom:'1px solid var(--s2)'}}><button onClick={()=>del(inv.id)} style={{background:'none',border:'none',color:'var(--m)',cursor:'pointer',fontSize:'11px',opacity:.4}}>✕</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
          <Card style={{borderLeft:'3px solid var(--lumeu)'}}>
            <SectionTitle>🏢 LUMEU — separado do portfolio</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--t2)',lineHeight:1.7}}>As faturas Emergent são custos de negócio LUMEU e <strong style={{color:'var(--lumeu)'}}>não entram no P&L pessoal</strong>. Ver aba LUMEU para detalhe.</div>
          </Card>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <Card>
            <SectionTitle>Estado das APIs</SectionTitle>
            {PLATS.map(p=>{
              const ok=apiStatus[p.key]==='ok'
              return (
                <div key={p.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--bd)'}}>
                  <div><div style={{fontSize:'12px',fontWeight:500}}>{p.label}</div><div style={{fontSize:'10px',color:'var(--m)'}}>{p.type}</div></div>
                  <span style={{fontSize:'10px',fontWeight:600,padding:'2px 8px',borderRadius:'100px',background:ok?'var(--green-dim)':'var(--s2)',color:ok?'var(--green)':'var(--m)'}}>{ok?'● ativo':'○ configurar'}</span>
                </div>
              )
            })}
          </Card>
          <Card>
            <SectionTitle>Alocação</SectionTitle>
            {investments.map((inv:any)=>{
              const w=totalInv>0?(inv.invested/totalInv*100).toFixed(0):'0'
              const pc=PLATS.find(p=>p.label===inv.platform)?.color||'#888'
              return (
                <div key={inv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'11px',marginBottom:'6px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'6px',height:'6px',borderRadius:'50%',background:pc}}/>{inv.platform}</div>
                  <span style={{fontFamily:'var(--fm)',color:'var(--m)'}}>{w}%</span>
                </div>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}