'use client'
import { useState } from 'react'
import { Card, SectionTitle, PageHeader } from '@/components/UI'

const QUESTIONS = [
  'Analisa a minha situação financeira e dá-me os 3 principais conselhos.',
  'Como estou a cumprir o orçamento este mês? Onde gasto mais do que devia?',
  'Avalia o meu portfolio de investimentos. O que deveria ajustar?',
  'Em quanto tempo atinjo a liberdade financeira com o ritmo atual?',
  'O investimento de 2.702€ no Bybit em Março foi uma boa decisão?',
  'Como ajustar o orçamento da Ana com o novo salário?',
  'Quanto custa o LUMEU por mês? Vale a pena continuar?',
  'Dá-me um plano concreto para atingir 50.000€ de liberdade financeira.',
]

interface Msg { role: 'user'|'assistant'; content: string }

export default function AIAdvisorPage() {
  const [msgs,setMsgs]=useState<Msg[]>([])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)

  async function send(q?:string) {
    const question=q||input.trim(); if(!question) return
    setInput(''); setLoading(true)
    const newMsgs:Msg[]=[...msgs,{role:'user',content:question}]
    setMsgs(newMsgs)
    try {
      const res=await fetch('/api/ai-advisor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})})
      const data=await res.json()
      setMsgs([...newMsgs,{role:'assistant',content:data.response||data.error||'Erro desconhecido'}])
    } catch {
      setMsgs([...newMsgs,{role:'assistant',content:'❌ Erro ao contactar a IA. Verifica a ANTHROPIC_API_KEY.'}])
    }
    setLoading(false)
  }

  return (
    <div className="fade-up">
      <PageHeader title="AI" italic="Advisor" sub="Powered by Claude · Contexto dos teus dados reais" accent="var(--purple)"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:'16px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <Card style={{minHeight:'420px',display:'flex',flexDirection:'column',gap:'16px'}}>
            {msgs.length===0?(
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',padding:'40px 20px',textAlign:'center'}}>
                <div style={{fontSize:'40px',marginBottom:'8px'}}>◎</div>
                <div style={{fontFamily:'var(--fd)',fontSize:'20px',fontStyle:'italic',color:'var(--purple)'}}>O teu conselheiro financeiro</div>
                <div style={{fontSize:'13px',color:'var(--m)',maxWidth:'380px',lineHeight:1.6}}>Analiso os teus dados reais — transações, investimentos, orçamentos — e dou conselhos personalizados.</div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                    <div style={{maxWidth:'85%',padding:'12px 16px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',background:m.role==='user'?'var(--purple)':'var(--s2)',color:m.role==='user'?'#fff':'var(--t)',fontSize:'13px',lineHeight:1.65,whiteSpace:'pre-wrap'}}>
                      {m.role==='assistant'&&<div style={{fontSize:'10px',color:'var(--m)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.07em'}}>◎ AI Advisor</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{padding:'12px 16px',borderRadius:'16px 16px 16px 4px',background:'var(--s2)',fontSize:'13px',color:'var(--m)',animation:'pulse 1.5s ease infinite'}}>A analisar os teus dados...</div></div>}
              </div>
            )}
          </Card>
          <div style={{display:'flex',gap:'8px'}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Pergunta sobre as tuas finanças..." disabled={loading} style={{flex:1,background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'12px 16px',outline:'none'}}/>
            <button onClick={()=>send()} disabled={loading||!input.trim()} style={{background:loading?'var(--s2)':'var(--purple)',color:loading?'var(--m)':'#fff',border:'none',borderRadius:'var(--rs)',fontSize:'13px',fontWeight:600,padding:'12px 20px',cursor:loading?'not-allowed':'pointer',transition:'all .15s'}}>
              {loading?'...':'Enviar'}
            </button>
          </div>
          {msgs.length>0&&<button onClick={()=>setMsgs([])} style={{background:'none',border:'none',color:'var(--m)',cursor:'pointer',fontSize:'11px',textAlign:'left'}}>↺ Nova conversa</button>}
        </div>
        <div>
          <Card>
            <SectionTitle>Perguntas rápidas</SectionTitle>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {QUESTIONS.map((q,i)=>(
                <button key={i} onClick={()=>send(q)} disabled={loading} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t2)',fontSize:'11px',padding:'9px 12px',cursor:'pointer',textAlign:'left',lineHeight:1.5,transition:'all .15s'}}>{q}</button>
              ))}
            </div>
          </Card>
          <Card style={{marginTop:'16px',borderTop:'2px solid var(--purple)'}}>
            <SectionTitle>Contexto da IA</SectionTitle>
            <div style={{fontSize:'11px',color:'var(--m)',lineHeight:1.8}}>
              <div>✓ Transações reais (Jan–Mar 2026)</div><div>✓ Portfolio investimentos</div>
              <div>✓ Orçamentos Rui + Ana</div><div>✓ Metas de poupança</div><div>✓ Despesas LUMEU</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}