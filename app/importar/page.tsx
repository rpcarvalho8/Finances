'use client'
import { useEffect, useState } from 'react'
import { Card, PageHeader, SectionTitle } from '@/components/UI'

type Account = { id: number; name: string; owner: string; ownerKey: string; institution: string; kind: string }
type Source = { id: string; label: string; accept: string; accountKind: string | null }
type Preview = {
  account: { id: number; name: string }
  fileSha256: string
  alreadyImported: boolean
  period: { from: string; to: string } | null
  counts: { total: number; new: number; duplicate: number; error: number }
  rows: Array<{ line: number; date: string; description: string; amount_cents: number; status: 'new' | 'duplicate' }>
  errors: Array<{ line: number; error: string }>
  warnings: string[]
}

const eur = (cents: number) => (cents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const inp: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', color: 'var(--t)', fontFamily: 'var(--fb)', fontSize: '13px', padding: '8px 11px', outline: 'none', width: '100%' }
const btn = (primary: boolean): React.CSSProperties => ({ background: primary ? 'var(--accent)' : 'var(--s2)', color: primary ? '#0c0c0f' : 'var(--t)', border: primary ? 'none' : '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '13px', fontWeight: 600, padding: '8px 16px', cursor: 'pointer' })

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [accountId, setAccountId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [newAcc, setNewAcc] = useState<{ name: string; kind: string; owner: string } | null>(null)

  async function loadAccounts(selectId?: number) {
    const a: Account[] = await fetch('/api/accounts').then((r) => r.json())
    setAccounts(a)
    if (selectId) setAccountId(String(selectId))
    else if (a[0] && !accountId) setAccountId(String(a[0].id))
  }

  useEffect(() => {
    loadAccounts()
    fetch('/api/import').then((r) => r.json()).then((s: Source[]) => { setSources(s); if (s[0]) setSourceId(s[0].id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preselect an account of the kind the format expects (e.g. meal card for Pluxee).
  function chooseSource(id: string) {
    setSourceId(id)
    setPreview(null)
    const kind = sources.find((s) => s.id === id)?.accountKind
    const match = kind ? accounts.find((a) => a.kind === kind) : null
    if (match) setAccountId(String(match.id))
    else if (kind === 'meal_card') setNewAcc({ name: 'Cartão refeição', kind: 'meal_card', owner: accounts.find((a) => a.ownerKey !== 'conjunta')?.ownerKey ?? 'conjunta' })
  }

  async function createAccount() {
    if (!newAcc) return
    const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAcc) })
    const data = await res.json()
    if (!res.ok) { setMessage({ ok: false, text: data.error ?? 'Erro' }); return }
    setNewAcc(null)
    await loadAccounts(data.id)
  }

  const owners = Array.from(new Map(accounts.map((a) => [a.ownerKey, a.owner])).entries())

  function form(mode: 'preview' | 'commit') {
    const fd = new FormData()
    fd.append('file', file as File)
    fd.append('source', sourceId)
    fd.append('account_id', accountId)
    fd.append('mode', mode)
    if (mode === 'commit' && preview) fd.append('sha256', preview.fileSha256)
    return fd
  }

  async function send(mode: 'preview' | 'commit') {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form(mode) })
      const data = await res.json()
      if (!res.ok) { setMessage({ ok: false, text: data.error ?? 'Erro' }); return }
      if (mode === 'preview') setPreview(data)
      else {
        setPreview(null)
        setMessage({ ok: true, text: `Importados ${data.inserted} movimentos. Já existiam ${data.duplicate}.${data.error ? ` ${data.error} linhas com erro ignoradas.` : ''}` })
      }
    } finally {
      setBusy(false)
    }
  }

  const accept = sources.find((s) => s.id === sourceId)?.accept ?? '.csv'

  return (
    <div className="fade-up">
      <PageHeader title="Impor" italic="tar" sub="Extratos do banco: pré-visualiza antes de gravar" />
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <label style={{ fontSize: '12px', color: 'var(--m)' }}>Formato
            <select value={sourceId} onChange={(e) => chooseSource(e.target.value)} style={inp}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '12px', color: 'var(--m)' }}>Conta de destino
            <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setPreview(null) }} style={inp}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.owner}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '12px', color: 'var(--m)' }}>Ficheiro
            <input type="file" accept={accept} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null) }} style={inp} />
          </label>
          <button disabled={!file || busy} onClick={() => send('preview')} style={btn(false)}>Pré-visualizar</button>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          {!newAcc ? (
            <button onClick={() => setNewAcc({ name: '', kind: 'checking', owner: owners[0]?.[0] ?? 'conjunta' })} style={{ ...btn(false), fontWeight: 400, padding: '4px 10px', fontSize: '12px' }}>+ Nova conta</button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '8px', alignItems: 'end' }}>
              <label style={{ color: 'var(--m)' }}>Nome<input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} style={inp} /></label>
              <label style={{ color: 'var(--m)' }}>Tipo
                <select value={newAcc.kind} onChange={(e) => setNewAcc({ ...newAcc, kind: e.target.value })} style={inp}>
                  <option value="checking">Conta à ordem</option>
                  <option value="savings">Poupança</option>
                  <option value="meal_card">Cartão refeição</option>
                  <option value="term_deposit">Depósito a prazo</option>
                  <option value="broker">Corretora</option>
                  <option value="crypto">Cripto</option>
                </select>
              </label>
              <label style={{ color: 'var(--m)' }}>De quem
                <select value={newAcc.owner} onChange={(e) => setNewAcc({ ...newAcc, owner: e.target.value })} style={inp}>
                  {owners.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
              <button onClick={createAccount} disabled={!newAcc.name.trim()} style={btn(true)}>Criar</button>
              <button onClick={() => setNewAcc(null)} style={btn(false)}>Cancelar</button>
            </div>
          )}
        </div>
        {message && <div style={{ marginTop: '12px', fontSize: '13px', color: message.ok ? 'var(--green)' : '#f96e6e' }}>{message.text}</div>}
      </Card>

      {preview && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Card>
            <SectionTitle right={<button disabled={busy || preview.counts.new === 0} onClick={() => send('commit')} style={btn(true)}>Importar {preview.counts.new} movimentos</button>}>
              {preview.account.name}{preview.period ? ` · ${preview.period.from} a ${preview.period.to}` : ''}
            </SectionTitle>
            <div style={{ fontSize: '13px', color: 'var(--t2)', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <span>Novos: <b>{preview.counts.new}</b></span>
              <span>Já existentes: <b>{preview.counts.duplicate}</b></span>
              <span>Com erro: <b>{preview.counts.error}</b></span>
            </div>
            {preview.alreadyImported && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--amber)' }}>Este ficheiro já foi importado para esta conta. Só entram movimentos que ainda não existam.</div>}
            {preview.warnings.map((w, i) => <div key={i} style={{ marginTop: '6px', fontSize: '12px', color: 'var(--amber)' }}>{w}</div>)}
            {preview.errors.slice(0, 50).map((e) => <div key={e.line} style={{ marginTop: '4px', fontSize: '12px', color: '#f96e6e' }}>Linha {e.line}: {e.error}</div>)}
          </Card>
          <Card>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--m)', textAlign: 'left' }}><th>Data</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Montante</th><th style={{ paddingLeft: '12px' }}>Estado</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} style={{ borderTop: '1px solid var(--bd)', opacity: r.status === 'duplicate' ? 0.5 : 1 }}>
                    <td style={{ padding: '6px 0', fontFamily: 'var(--fm)' }}>{r.date}</td>
                    <td>{r.description}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--fm)', color: r.amount_cents < 0 ? '#f96e6e' : '#6ef9a8' }}>{eur(r.amount_cents)}</td>
                    <td style={{ paddingLeft: '12px' }}>{r.status === 'new' ? 'novo' : 'já existe'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
