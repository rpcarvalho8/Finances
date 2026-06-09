'use client'
import React from 'react'

export function fmt(v: number): string {
  return Math.abs(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'
}

export function Card({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'20px',...style}}>{children}</div>
}

export function StatCard({label,value,sub,color='var(--t)',pin}:{label:string;value:string;sub?:string;color?:string;pin?:string}) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'16px 18px',position:'relative',overflow:'hidden'}}>
      <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.08em',color:'var(--m)',marginBottom:'6px'}}>{label}</div>
      <div style={{fontFamily:'var(--fm)',fontSize:'20px',fontWeight:500,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:'11px',color:'var(--m)',marginTop:'4px'}}>{sub}</div>}
      {pin && <div style={{position:'absolute',top:'12px',right:'12px',width:'7px',height:'7px',borderRadius:'50%',background:pin}}/>}
    </div>
  )
}

export function SectionTitle({children,right}:{children:React.ReactNode;right?:React.ReactNode}) {
  return (
    <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--m)',marginBottom:'14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>{children}</span>
      {right && <span style={{fontStyle:'italic',textTransform:'none',letterSpacing:0,fontSize:'11px'}}>{right}</span>}
    </div>
  )
}

export function PageHeader({title,italic,sub,accent}:{title:string;italic:string;sub?:string;accent?:string}) {
  return (
    <div style={{marginBottom:'28px'}}>
      <h1 style={{fontFamily:'var(--fd)',fontSize:'32px',fontWeight:400,lineHeight:1.1,letterSpacing:'-0.5px'}}>
        {title} <em style={{fontStyle:'italic',color:accent||'var(--accent)'}}>{italic}</em>
      </h1>
      {sub && <p style={{color:'var(--m)',fontSize:'12px',marginTop:'4px'}}>{sub}</p>}
    </div>
  )
}

export function CategoryBar({name,icon,spent,budget,color,percent}:{name:string;icon:string;spent:number;budget:number;color:string;percent:number}) {
  const over = budget>0 && spent>budget
  const barW = budget>0 ? Math.min(spent/budget*100,100) : Math.min(percent*1.5,100)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
        <div style={{fontSize:'12px',fontWeight:500,display:'flex',alignItems:'center',gap:'6px'}}>
          {icon} {name}
          {over && <span style={{fontSize:'9px',color:'var(--red)',background:'var(--red-dim)',padding:'1px 5px',borderRadius:'100px'}}>acima</span>}
        </div>
        <div style={{fontFamily:'var(--fm)',fontSize:'11px',color:'var(--m)',display:'flex',gap:'5px'}}>
          <span style={{color:over?'var(--red)':'var(--t)',fontWeight:500}}>{fmt(spent)}</span>
          {budget>0 && <span>/ {fmt(budget)}</span>}
          <span style={{color:'var(--amber)',fontSize:'10px'}}>{percent}%</span>
        </div>
      </div>
      <div style={{height:'4px',background:'var(--s2)',borderRadius:'100px',overflow:'hidden'}}>
        <div style={{height:'100%',width:`${barW}%`,background:over?'var(--red)':color,borderRadius:'100px',transition:'width .5s'}}/>
      </div>
    </div>
  )
}

export function TxnRow({date,description,category,amount,icon,onDelete}:{date:string;description:string;category:string;amount:number;icon?:string;onDelete?:()=>void}) {
  const isPos = amount>0
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--bd)',gap:'10px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'9px',flex:1,minWidth:0}}>
        <div style={{width:'30px',height:'30px',borderRadius:'7px',background:'var(--s2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',flexShrink:0}}>
          {icon||(isPos?'💵':'💳')}
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:'12px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{description}</div>
          <div style={{fontSize:'10px',color:'var(--m)'}}>{category}</div>
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0,display:'flex',alignItems:'center',gap:'8px'}}>
        <div>
          <div style={{fontFamily:'var(--fm)',fontSize:'12px',fontWeight:500,color:isPos?'var(--green)':'var(--red)'}}>{isPos?'+':'-'}{fmt(Math.abs(amount))}</div>
          <div style={{fontSize:'10px',color:'var(--m)'}}>{date.slice(5).replace('-','/')}</div>
        </div>
        {onDelete && <button onClick={onDelete} style={{background:'none',border:'none',color:'var(--m)',cursor:'pointer',fontSize:'11px',opacity:.4,padding:'2px 4px'}}>✕</button>}
      </div>
    </div>
  )
}

export function GoalBar({name,saved,target,color}:{name:string;saved:number;target:number;color:string}) {
  const pct = Math.min(Math.round(saved/target*100),100)
  return (
    <div style={{padding:'10px 0',borderBottom:'1px solid var(--bd)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
        <div style={{fontSize:'12px',fontWeight:500}}>{name}</div>
        <div style={{fontFamily:'var(--fm)',fontSize:'11px',color}}>{pct}%</div>
      </div>
      <div style={{height:'4px',background:'var(--s2)',borderRadius:'100px',overflow:'hidden',marginBottom:'4px'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:'100px',transition:'width .5s'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'var(--m)'}}>
        <span>{fmt(saved)} / {fmt(target)}</span>
        <span>falta {fmt(target-saved)}</span>
      </div>
    </div>
  )
}

export function AddTransactionForm({owner,cats,onAdd}:{owner:string;cats?:string[];onAdd?:()=>void}) {
  async function handleSubmit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const type = fd.get('type') as string
    const rawAmt = parseFloat(fd.get('amount') as string)
    const amount = type==='income' ? Math.abs(rawAmt) : -Math.abs(rawAmt)
    await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:fd.get('date'),description:fd.get('description'),amount,type,category:fd.get('category'),owner})})
    ;(e.target as HTMLFormElement).reset()
    onAdd?.()
  }
  const today = new Date().toISOString().split('T')[0]
  const inp:React.CSSProperties = {background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:'var(--rs)',color:'var(--t)',fontFamily:'var(--fb)',fontSize:'13px',padding:'8px 11px',outline:'none',width:'100%'}
  const DEFAULT_CATS = ['Habitação','Alimentação','Lazer','Investimentos','Poupança','Transportes','Necessidades Básicas','Saúde','Compras','LUMEU','Outros']
  return (
    <form onSubmit={handleSubmit}>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <div style={{flex:'2',minWidth:'150px',display:'flex',flexDirection:'column',gap:'3px'}}>
          <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)'}}>Descrição</label>
          <input name="description" placeholder="ex: Supermercado" required style={inp}/>
        </div>
        <div style={{flex:'1',minWidth:'90px',display:'flex',flexDirection:'column',gap:'3px'}}>
          <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)'}}>Valor (€)</label>
          <input name="amount" type="number" step="0.01" placeholder="0.00" required style={inp}/>
        </div>
        <div style={{flex:'1',minWidth:'100px',display:'flex',flexDirection:'column',gap:'3px'}}>
          <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)'}}>Data</label>
          <input name="date" type="date" defaultValue={today} required style={inp}/>
        </div>
        <div style={{flex:'1',minWidth:'120px',display:'flex',flexDirection:'column',gap:'3px'}}>
          <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)'}}>Categoria</label>
          <select name="category" style={inp}>
            {(cats||DEFAULT_CATS).map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{flex:'1',minWidth:'100px',display:'flex',flexDirection:'column',gap:'3px'}}>
          <label style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.07em',color:'var(--m)'}}>Tipo</label>
          <select name="type" style={inp}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="investment">Investimento</option>
            <option value="savings">Poupança</option>
          </select>
        </div>
        <div style={{display:'flex',alignItems:'flex-end'}}>
          <button type="submit" style={{background:'var(--accent)',color:'#0c0c0f',border:'none',borderRadius:'var(--rs)',fontFamily:'var(--fb)',fontSize:'13px',fontWeight:600,padding:'8px 16px',cursor:'pointer'}}>+ Add</button>
        </div>
      </div>
    </form>
  )
}

export function ImportCSV({owner}:{owner:string}) {
  async function handleFile(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file) return
    const fd = new FormData(); fd.append('file',file); fd.append('owner',owner)
    fd.append('bank', owner==='conjunta'?'abanca':'activobank')
    const res = await fetch('/api/import',{method:'POST',body:fd})
    const data = await res.json()
    alert(`✅ Importadas: ${data.imported} | Duplicadas: ${data.skipped}${data.errors?.length?' | Erros: '+data.errors.length:''}`)
    window.location.reload()
  }
  return (
    <label style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'var(--rs)',background:'var(--s2)',border:'1px solid var(--bd)',color:'var(--t2)',fontSize:'12px',cursor:'pointer'}}>
      📥 Importar CSV
      <input type="file" accept=".csv,.xlsx" onChange={handleFile} style={{display:'none'}}/>
    </label>
  )
}
