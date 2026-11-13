/**
 * Demo seed with SYNTHETIC data only (SEC-D03, decided 2026-11-06).
 *
 * Every amount, merchant and description below is invented. Never add real
 * household data here: real data enters only by importing files kept in
 * `private-data/` (ignored by git).
 *
 * This script is DESTRUCTIVE: it deletes and re-inserts accounts, categories,
 * investments, goals, transactions and business expenses. If the database
 * already holds transactions it refuses to run unless you pass `--force`.
 * For a non-destructive setup use `npm run db:init`.
 */
import { closeDb, db } from '../lib/db'
import { initDB } from '../lib/migrate'

type Txn = [date: string, description: string, amount: number, type: string, owner: string, category: string]

export const CATEGORIES: Array<[name: string, icon: string, color: string, type: string, owner: string, budgetPct: number, isBusiness: number]> = [
  ['Receita', '💵', '#6ef9a8', 'income', 'all', 0, 0],
  ['Habitação', '🏠', '#7eb8f9', 'expense', 'all', 35, 0],
  ['Alimentação', '🛒', '#c8f97e', 'expense', 'all', 20, 0],
  ['Lazer', '🎭', '#a07ef9', 'expense', 'all', 8, 0],
  ['Investimentos', '📈', '#6ef9a8', 'expense', 'all', 0, 0],
  ['Poupança', '💰', '#5ef0d8', 'expense', 'all', 0, 0],
  ['Transportes', '🚗', '#f9c67e', 'expense', 'all', 10, 0],
  ['Necessidades Básicas', '📱', '#f9f97e', 'expense', 'rui', 50, 0],
  ['Liberdade Financeira', '📈', '#6ef9a8', 'expense', 'rui', 13, 0],
  ['Despesas Carro', '🚗', '#f9c67e', 'expense', 'rui', 10, 0],
  ['Fundo de Emergência', '🛡️', '#f97ec8', 'expense', 'rui', 10, 0],
  ['Despesas Educação', '📚', '#f9f97e', 'expense', 'rui', 5, 0],
  ['Saúde', '❤️', '#f97ec8', 'expense', 'all', 0, 0],
  ['Compras', '🛍️', '#f96e6e', 'expense', 'all', 0, 0],
  ['Família', '👨‍👩‍👦', '#ff9fb2', 'expense', 'all', 0, 0],
  ['Transferências', '↔️', '#888', 'transfer', 'all', 0, 0],
  ['Utilidades', '💡', '#f9c67e', 'expense', 'conjunta', 12, 0],
  ['LUMEU', '🏢', '#ff9f43', 'expense', 'rui', 0, 1],
  ['Outros', '📦', '#666', 'expense', 'all', 0, 0],
]

/** Three synthetic months of activity per owner, generated deterministically. */
export function syntheticTransactions(): Txn[] {
  const out: Txn[] = []
  for (const m of ['01', '02', '03']) {
    const d = (day: string) => `2026-${m}-${day}`
    // Personal account A
    out.push(
      [d('01'), 'TRANSFERENCIA ENTRADA EXEMPLO', 1000.0, 'income', 'rui', 'Receita'],
      [d('02'), 'TRF PARA POUPANCA EXEMPLO', -100.0, 'savings', 'rui', 'Poupança'],
      [d('05'), 'TRF PARA CORRETORA EXEMPLO', -50.0, 'investment', 'rui', 'Investimentos'],
      [d('08'), 'SUPERMERCADO EXEMPLO A', -45.3, 'expense', 'rui', 'Alimentação'],
      [d('12'), 'COMBUSTIVEL EXEMPLO', -40.0, 'expense', 'rui', 'Transportes'],
      [d('15'), 'RESTAURANTE EXEMPLO', -22.5, 'expense', 'rui', 'Lazer'],
      [d('20'), 'SUBSCRICAO STREAMING EXEMPLO', -9.99, 'expense', 'rui', 'Necessidades Básicas'],
    )
    // Personal account B
    out.push(
      [d('01'), 'TRANSFERENCIA ENTRADA EXEMPLO', 800.0, 'income', 'ana', 'Receita'],
      [d('06'), 'SUPERMERCADO EXEMPLO B', -38.2, 'expense', 'ana', 'Alimentação'],
      [d('14'), 'FARMACIA EXEMPLO', -12.4, 'expense', 'ana', 'Saúde'],
      [d('22'), 'LOJA ROUPA EXEMPLO', -35.0, 'expense', 'ana', 'Compras'],
    )
    // Joint account
    out.push(
      [d('01'), 'CONTRIBUICAO MENSAL A', 500.0, 'income', 'conjunta', 'Receita'],
      [d('01'), 'CONTRIBUICAO MENSAL B', 400.0, 'income', 'conjunta', 'Receita'],
      [d('02'), 'PRESTACAO CREDITO EXEMPLO', -400.0, 'expense', 'conjunta', 'Habitação'],
      [d('05'), 'CONDOMINIO EXEMPLO', -45.0, 'expense', 'conjunta', 'Habitação'],
      [d('07'), 'AGUA EXEMPLO', -20.0, 'expense', 'conjunta', 'Utilidades'],
      [d('09'), 'TELECOMUNICACOES EXEMPLO', -30.0, 'expense', 'conjunta', 'Utilidades'],
      [d('18'), 'SUPERMERCADO EXEMPLO C', -120.75, 'expense', 'conjunta', 'Alimentação'],
    )
  }
  return out
}

async function seed() {
  await initDB()

  const force = process.argv.includes('--force')
  const { rows } = await db.execute(`SELECT COUNT(*) AS n FROM transactions`)
  if (Number(rows[0].n) > 0 && !force) {
    console.error(
      `A BD já tem ${rows[0].n} movimentos. O seed APAGA dados. ` +
        'Faz primeiro `npm run db:backup` e depois `npm run db:seed -- --force` se tens a certeza.',
    )
    process.exit(1)
  }

  console.log('🌱 A inserir dados sintéticos...')

  await db.execute(`DELETE FROM accounts`)
  await db.execute(`INSERT INTO accounts (name,owner,bank,type,balance,color) VALUES
    ('Conta Pessoal (exemplo)','rui','activobank','checking',0,'#7eb8f9'),
    ('Conta Conjunta (exemplo)','conjunta','abanca','checking',0,'#f9c67e'),
    ('Conta Pessoal (exemplo)','ana','activobank','checking',0,'#f97ec8')`)

  await db.execute(`DELETE FROM categories`)
  for (const c of CATEGORIES) {
    await db.execute({
      sql: `INSERT INTO categories (name,icon,color,type,owner,budget_pct,is_business) VALUES (?,?,?,?,?,?,?)`,
      args: c,
    })
  }

  await db.execute(`DELETE FROM investments`)
  await db.execute(`INSERT INTO investments (platform,type,name,invested,current_value,owner) VALUES
    ('Corretora Exemplo','etf','ETF Exemplo',300.00,310.00,'rui'),
    ('PPR Exemplo','ppr','PPR Exemplo',500.00,505.00,'rui'),
    ('Poupança Exemplo','savings','Conta Poupança Exemplo',1000.00,1000.00,'ana')`)

  await db.execute(`DELETE FROM goals`)
  await db.execute(`INSERT INTO goals (name,icon,target,saved,owner,color) VALUES
    ('Fundo de Emergência','🛡️',3000,750,'rui','#f97ec8'),
    ('Fundo de Emergência','🛡️',3000,500,'ana','#6ef9a8'),
    ('Férias','✈️',1500,300,'familia','#a07ef9')`)

  await db.execute(`DELETE FROM transactions`)
  for (const [date, description, amount, type, owner, category] of syntheticTransactions()) {
    await db.execute({
      sql: `INSERT INTO transactions (date,description,amount,type,owner,category_id,account_id)
            SELECT ?,?,?,?,?,c.id,a.id FROM categories c, accounts a WHERE c.name=? AND a.owner=? LIMIT 1`,
      args: [date, description, amount, type, owner, category, owner],
    })
  }

  await db.execute(`DELETE FROM lumeu_expenses`)
  await db.execute(`INSERT INTO lumeu_expenses (date,description,amount,category,vendor) VALUES
    ('2026-01-15','ALOJAMENTO WEB EXEMPLO',15.00,'infra','Fornecedor Exemplo'),
    ('2026-02-15','ALOJAMENTO WEB EXEMPLO',15.00,'infra','Fornecedor Exemplo')`)

  console.log('✅ Seed sintético completo!')
}

if (require.main === module) {
  seed()
    .then(() => closeDb())
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
