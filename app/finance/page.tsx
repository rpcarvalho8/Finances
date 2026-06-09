'use client'
import { useState, useEffect } from 'react'
import { StatCard, Card, SectionTitle, PageHeader, fmt } from '@/components/UI'

export default function FinancePage() {
  const [finances, setFinances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFinances = async () => {
      try {
        const res = await fetch('/api/finances')
        if (res.ok) {
          const data = await res.json()
          setFinances(data)
        }
      } catch (error) {
        console.error('Error loading finances:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFinances()
  }, [])

  return (
    <div className="fade-up">
      <PageHeader title="Finanças" italic="Pessoais" sub="Gastos · Receitas · Poupança"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Total gasto" value={fmt(0)} sub="este mês" color="var(--red)" pin="var(--red)"/>
        <StatCard label="Total recebido" value={fmt(0)} sub="este mês" color="var(--green)" pin="var(--green)"/>
        <StatCard label="Poupança" value={fmt(0)} sub="saldo" color="var(--blue)" pin="var(--blue)"/>
      </div>
      <Card>
        <SectionTitle>Registos</SectionTitle>
        {loading ? (
          <div style={{color:'var(--m)',fontSize:'12px'}}>A carregar...</div>
        ) : (
          <div style={{fontSize:'12px',color:'var(--t2)'}}>
            {finances.length === 0 ? 'Sem registos' : `${finances.length} registos encontrados`}
          </div>
        )}
      </Card>
    </div>
  )
}
