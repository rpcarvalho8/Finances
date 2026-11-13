'use client'
import { useEffect, useState } from 'react'

/** Monthly income bases configured in Definições (never hardcoded in source). */
export type Budgets = {
  rui_income: number
  ana_income: number
  joint_income: number
}

const EMPTY: Budgets = { rui_income: 0, ana_income: 0, joint_income: 0 }

export function parseBudgets(raw: unknown): Budgets {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return { rui_income: num(r.rui_income), ana_income: num(r.ana_income), joint_income: num(r.joint_income) }
}

export function useBudgets(): Budgets {
  const [b, setB] = useState<Budgets>(EMPTY)
  useEffect(() => {
    fetch('/api/settings/budgets')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => setB(parseBudgets(j)))
      .catch(() => setB(EMPTY))
  }, [])
  return b
}
