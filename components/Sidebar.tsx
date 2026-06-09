'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV = [
  {href:'/',label:'Dashboard',icon:'⬡',color:'#c8f97e'},
  {href:'/rui',label:'Rui',icon:'◉',color:'#7eb8f9'},
  {href:'/ana',label:'Ana',icon:'◉',color:'#f97ec8'},
  {href:'/conjunta',label:'Conta Conjunta',icon:'◈',color:'#f9c67e'},
  {href:'/investimentos',label:'Investimentos',icon:'◈',color:'#6ef9a8'},
  {href:'/ai-advisor',label:'AI Advisor',icon:'◎',color:'#a07ef9'},
  {href:'/settings',label:'Definições',icon:'⊙',color:'#7a7a8c'},
]

export default function Sidebar() {
  const path = usePathname()
  const [businesses, setBusinesses] = useState<Array<{id:string; name:string; slug:string}>>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch('/api/business')
      .then(res => res.json())
      .then(data => {
        setBusinesses(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch businesses:', err)
        setLoading(false)
      })
  }, [])

  const handleAddBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      })
      if (!res.ok) throw new Error('Failed to create business')
      const newBusiness = await res.json()
      setBusinesses(prev => [...prev, newBusiness])
      setNewName('')
      setAddOpen(false)
    } catch (err) {
      console.error('Error creating business:', err)
      alert('Failed to create business. Please try again.')
    }
  }

  return (
    <aside style={{position:'fixed',top:0,left:0,bottom:0,width:'220px',background:'var(--surface)',borderRight:'1px solid var(--bd)',display:'flex',flexDirection:'column',padding:'24px 0',zIndex:100}}>
      <div style={{padding:'0 20px 24px',borderBottom:'1px solid var(--bd)'}}>
        <div style={{fontFamily:'var(--fd)',fontSize:'22px',fontStyle:'italic',color:'var(--accent)',letterSpacing:'-0.5px'}}>Finance OS</div>
        <div style={{fontSize:'11px',color:'var(--m)',marginTop:'2px'}}>Rui & Ana · 2026</div>
      </div>
      <nav style={{flex:1,padding:'16px 12px',display:'flex',flexDirection:'column',gap:'2px'}}>
        {NAV.map(item => {
          const active = path === item.href
          return (
            <Link key={item.href} href={item.href} style={{textDecoration:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',borderRadius:'var(--rs)',background:active?`${item.color}18`:'transparent',border:active?`1px solid ${item.color}30`:'1px solid transparent',color:active?item.color:'var(--t2)',fontSize:'13px',fontWeight:active?500:400,cursor:'pointer',transition:'all .15s'}}>
                <span style={{fontSize:'14px',opacity:active?1:0.5}}>{item.icon}</span>
                {item.label}
                {active && <div style={{marginLeft:'auto',width:'4px',height:'4px',borderRadius:'50%',background:item.color}}/>}
              </div>
            </Link>
          )
        })}
      </nav>
      {/* Negócios collapsible section */}
      <div style={{marginTop:'12px',borderTop:'1px solid var(--bd)',paddingTop:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <h3 style={{fontSize:'14px',fontWeight:600,color:'var(--t)',margin:0}}>Negócios</h3>
          <button onClick={() => setAddOpen(!addOpen)} style={{background:'none',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontSize:'12px',padding:'4px 8px',cursor:'pointer'}}>
            +
          </button>
        </div>
        {loading ? (
          <div style={{color:'var(--m)',fontSize:'12px',textAlign:'center',padding:'8px 0'}}>A carregar...</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
            {businesses.map(business => (
              <Link key={business.id} href={`/business/${business.slug}`} style={{textDecoration:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'6px 8px',borderRadius:'var(--rs)',cursor:'pointer'}}>
                  <span style={{fontSize:'14px'}}>◆</span>
                  {business.name}
                </div>
              </Link>
            ))}
          </div>
        )}
        {/* Add business modal */}
        {addOpen && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',padding:'24px',width:'280px'}}>
              <h3 style={{fontSize:'16px',fontWeight:600,marginBottom:'16px',color:'var(--t)'}}>Criar Novo Negócio</h3>
              <form onSubmit={handleAddBusiness} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div>
                  <label style={{fontSize:'12px',color:'var(--m)',marginBottom:'4px',display:'block'}}>Nome do Negócio</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Novo Empreendimento"
                    style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'7px 10px',outline:'none',width:'100%'}}
                  />
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                  <button type="button" onClick={() => setAddOpen(false)} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontSize:'12px',padding:'6px 12px',cursor:'pointer'}}>
                    Cancelar
                  </button>
                  <button type="submit" style={{background:'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontSize:'12px',fontWeight:600,padding:'6px 12px',cursor:'pointer'}}>
                    Criar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <div style={{padding:'16px 20px',borderTop:'1px solid var(--bd)',fontSize:'11px',color:'var(--m)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)'}}/>
          A correr localmente
        </div>
        <div>Ubuntu · Dev Mode</div>
      </div>
    </aside>
  )
}
