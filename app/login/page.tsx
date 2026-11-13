'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        window.location.href = '/'
        return
      }
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Não foi possível entrar')
    } catch {
      setError('Sem ligação ao servidor')
    } finally {
      setBusy(false)
    }
  }

  const inp: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', color: 'var(--t)', fontFamily: 'var(--fb)', fontSize: '14px', padding: '10px 12px', outline: 'none', width: '100%' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '340px', background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontFamily: 'var(--fd)', fontSize: '24px', fontStyle: 'italic', color: 'var(--accent)' }}>Finance OS</div>
        <label style={{ fontSize: '11px', color: 'var(--m)' }}>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inp, marginTop: '4px' }} />
        </label>
        <label style={{ fontSize: '11px', color: 'var(--m)' }}>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inp, marginTop: '4px' }} />
        </label>
        {error && <div role="alert" style={{ color: 'var(--red)', fontSize: '12px' }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ background: 'var(--accent)', color: '#0c0c0f', border: 'none', borderRadius: 'var(--rs)', fontSize: '13px', fontWeight: 600, padding: '10px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
