'use client'
import { useState } from 'react'
import { Card, SectionTitle, PageHeader } from '@/components/UI'

export default function SettingsPage() {
  const [budgets,setBudgets]=useState({rui_income:'',ana_income:'',joint_income:'',rui_conj:'',ana_conj:''})
  const [budgetSaved,setBudgetSaved]=useState(false)

  async function saveBudgets(){
    await fetch('/api/settings/budgets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(budgets)})
    setBudgetSaved(true);setTimeout(()=>setBudgetSaved(false),2000)
  }

  const inp:React.CSSProperties={background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'8px 11px',outline:'none',flex:1}

  return (
    <div className="fade-up">
      <PageHeader title="Defini" italic="ções" sub="Orçamentos e sistema"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <h2 style={{fontFamily:'var(--fd)',fontSize:'18px',fontStyle:'italic',color:'var(--t2)'}}>Integrações</h2>
          <Card style={{borderTop:'2px solid var(--amber)'}}>
            <SectionTitle>Desligadas por agora</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--m)',lineHeight:1.7}}>
              A ligação bancária (Open Banking), as chaves de corretoras e o AI Advisor estão desligados até existir autenticação e armazenamento seguro de segredos (fases C/D).
              Os dados entram por importação de ficheiros CSV/PDF.
            </div>
          </Card>
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
            {[{l:'Estado',v:'● A correr',c:'var(--green)'},{l:'Modo',v:'Desenvolvimento',c:'var(--amber)'},{l:'Base de dados',v:'SQLite local',c:'var(--t2)'},{l:'Porta',v:'localhost:3002',c:'var(--blue)'}].map(item=>(
              <div key={item.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--bd)'}}>
                <span style={{color:'var(--m)',fontSize:'12px'}}>{item.l}</span>
                <span style={{color:item.c,fontFamily:'var(--fm)',fontSize:'11px'}}>{item.v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <SectionTitle>Backup</SectionTitle>
            <div style={{fontSize:'12px',color:'var(--m)',lineHeight:1.6}}>
              O download pelo browser foi desligado. Para fazer uma cópia da base de dados, corre no terminal do PC: <code>npm run db:backup</code> (fica em <code>backups/</code>, fora do git).
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}