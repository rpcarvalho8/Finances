'use client'
import { useState } from 'react'
import { Card, SectionTitle, PageHeader } from '@/components/UI'

const APIS = [
  {key:'xtb',label:'XTB',color:'#7eb8f9',fields:[{n:'account_id',l:'Account ID'},{n:'password',l:'Password',t:'password'}],docs:'https://developers.xtb.com/'},
  {key:'ibkr',label:'Interactive Brokers',color:'#5ef0d8',fields:[{n:'host',l:'TWS Host (ex: localhost)'},{n:'port',l:'Porta (ex: 7497)'}],docs:'https://interactivebrokers.github.io/tws-api/'},
  {key:'bybit',label:'Bybit EU',color:'#f9c67e',fields:[{n:'api_key',l:'API Key'},{n:'api_secret',l:'API Secret',t:'password'}],docs:'https://bybit-exchange.github.io/docs/'},
  {key:'binance',label:'Binance',color:'#f9c67e',fields:[{n:'api_key',l:'API Key'},{n:'api_secret',l:'API Secret',t:'password'}],docs:'https://binance-docs.github.io/apidocs/'},
  {key:'t212',label:'Trading212',color:'#6ef9a8',fields:[{n:'api_key',l:'API Key'}],docs:'https://t212public-api-docs.redoc.ly/'},
  {key:'anthropic',label:'Anthropic (AI Advisor)',color:'#a07ef9',fields:[{n:'api_key',l:'API Key (sk-ant-...)',t:'password'}],docs:'https://console.anthropic.com/'},
]

export default function SettingsPage() {
  const [vals,setVals]=useState<Record<string,Record<string,string>>>({})
  const [saved,setSaved]=useState<Record<string,boolean>>({})
  const [budgets,setBudgets]=useState({rui_income:'1159.30',ana_income:'301.18',joint_income:'650.00',rui_conj:'350.00',ana_conj:'300.00'})
  const [budgetSaved,setBudgetSaved]=useState(false)

  async function saveApi(key:string){
    await fetch('/api/settings/api-keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:key,...(vals[key]||{})})})
    setSaved(s=>({...s,[key]:true}));setTimeout(()=>setSaved(s=>({...s,[key]:false})),2000)
  }
  async function saveBudgets(){
    await fetch('/api/settings/budgets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(budgets)})
    setBudgetSaved(true);setTimeout(()=>setBudgetSaved(false),2000)
  }

  const connectBank = async () => {
    try {
      const response = await fetch('/api/sync/bank/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        alert('Erro ao conectar banco: ' + (error.error || 'Tente novamente'))
        return
      }

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('URL de autorização não recebida')
      }
    } catch (err: any) {
      alert('Erro: ' + err.message)
    }
  };

  const inp:React.CSSProperties={background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'8px 11px',outline:'none',flex:1}

  return (
    <div className="fade-up">
      <PageHeader title="Defini" italic="ções" sub="APIs, orçamentos e sistema"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <h2 style={{fontFamily:'var(--fd)',fontSize:'18px',fontStyle:'italic',color:'var(--t2)'}}>Chaves de API</h2>
          {APIS.map(api=>(
            <Card key={api.key} style={{borderTop:`2px solid ${api.color}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:'13px'}}>{api.label}</div>
                  {api.docs&&<a href={api.docs} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:api.color,textDecoration:'none'}}>Ver docs →</a>}
                </div>
                <button onClick={()=>saveApi(api.key)} style={{background:saved[api.key]?'var(--green)':api.color,color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'11px',fontWeight:600,padding:'5px 12px',cursor:'pointer',transition:'background .2s'}}>{saved[api.key]?'✓ Guardado':'Guardar'}</button>
              </div>
              {api.fields.map(f=>(
                <div key={f.n} style={{marginBottom:'8px'}}>
                  <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)',display:'block',marginBottom:'3px'}}>{f.l}</label>
                  <input type={f.t||'text'} value={vals[api.key]?.[f.n]||''} onChange={e=>setVals(v=>({...v,[api.key]:{...v[api.key],[f.n]:e.target.value}}))} placeholder={f.t==='password'?'••••••••':f.l} style={inp}/>
                </div>
              ))}
            </Card>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <h2 style={{fontFamily:'var(--fd)',fontSize:'18px',fontStyle:'italic',color:'var(--t2)'}}>Orçamento</h2>
          <Card>
            <SectionTitle>Receitas base mensais</SectionTitle>
            {[{k:'rui_income',l:'🔵 Rui — conta pessoal'},{k:'ana_income',l:'🩷 Ana — conta pessoal'},{k:'joint_income',l:'🟡 Conta conjunta total'},{k:'rui_conj',l:'🔵 Rui → contrib. conjunta'},{k:'ana_conj',l:'🩷 Ana → contrib. conjunta'}].map(item=>(
              <div key={item.k} style={{marginBottom:'10px'}}>
                <label style={{fontSize:'11px',color:'var(--m)',display:'block',marginBottom:'3px'}}>{item.l}</label>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" step="0.01" value={budgets[item.k as keyof typeof budgets]} onChange={e=>setBudgets(b=>({...b,[item.k]:e.target.value}))} style={{...inp,maxWidth:'140px'}}/>
                  <span style={{fontSize:'12px',color:'var(--m)'}}>€/mês</span>
                </div>
              </div>
            ))}
            <button onClick={saveBudgets} style={{marginTop:'8px',background:budgetSaved?'var(--green)':'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'8px 16px',cursor:'pointer',transition:'background .2s'}}>{budgetSaved?'✓ Guardado':'Guardar orçamento'}</button>
          </Card>
          <Card style={{borderTop:'2px solid var(--green)'}}>
            <SectionTitle>Sistema</SectionTitle>
            {[{l:'Estado',v:'● A correr',c:'var(--green)'},{l:'Modo',v:'Desenvolvimento',c:'var(--amber)'},{l:'Base de dados',v:'SQLite local',c:'var(--t2)'},{l:'Porta',v:'localhost:3000',c:'var(--blue)'}].map(item=>(
              <div key={item.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--bd)'}}>
                <span style={{color:'var(--m)',fontSize:'12px'}}>{item.l}</span>
                <span style={{color:item.c,fontFamily:'var(--fm)',fontSize:'11px'}}>{item.v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <SectionTitle>Backup</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--m)',marginBottom:'12px',lineHeight:1.6}}>Faz download da base de dados local para guardar.</div>
            <button onClick={async()=>{const r=await fetch('/api/backup');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`finance-backup-${new Date().toISOString().slice(0,10)}.db`;a.click()}} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontSize:'12px',padding:'8px 14px',cursor:'pointer'}}>📥 Download backup</button>
          </Card>

          <Card style={{borderTop:'2px solid var(--green)'}}>
            <SectionTitle>Open Banking (Enable Banking)</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--m)',marginBottom:'12px',lineHeight:1.6}}>Conecte contas bancárias reais via Enable Banking para atualizar saldos e transações.</div>
            <button onClick={connectBank} style={{background:'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',padding:'8px 16px',cursor:'pointer'}}>
              🔗 Conectar Conta Bancária (API)
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}