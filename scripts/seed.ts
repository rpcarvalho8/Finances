/**
 * Demo seed with SYNTHETIC data only (SEC-D03, decided 2026-11-06).
 *
 * Every amount, merchant and description below is invented. Never add real
 * household data here: real data enters only by importing files kept in
 * `private-data/` (ignored by git).
 *
 * Order: `npm run db:migrate` → `npm run user -- add …` (creates the household,
 * its default categories and accounts) → `npm run db:seed`.
 *
 * Synthetic owners: 'a' = first member, 'b' = second member (rows skipped if
 * there is only one), 'conjunta' = joint account.
 *
 * DESTRUCTIVE for the household it seeds: it deletes its movements, goals and
 * manual investments and re-inserts the synthetic ones. If the household already
 * has movements it refuses to run unless you pass `--force`.
 */
import { closeDb, getDb } from '../lib/db'
import { initDB } from '../lib/migrate'
import { parseAmountToCents } from '../lib/money'

export type SeedOwner = 'a' | 'b' | 'conjunta'
type Txn = [date: string, description: string, amount: number, kind: string, owner: SeedOwner, category: string]

/** Three synthetic months of activity per owner, generated deterministically. Amounts in euros (converted to cents on insert). */
export function syntheticTransactions(): Txn[] {
  const out: Txn[] = []
  for (const m of ['01', '02', '03']) {
    const d = (day: string) => `2026-${m}-${day}`
    out.push(
      [d('01'), 'TRANSFERENCIA ENTRADA EXEMPLO', 1000.0, 'income', 'a', 'Receita'],
      [d('02'), 'TRF PARA POUPANCA EXEMPLO', -100.0, 'savings', 'a', 'Poupança'],
      [d('05'), 'TRF PARA CORRETORA EXEMPLO', -50.0, 'investment', 'a', 'Investimentos'],
      [d('08'), 'SUPERMERCADO EXEMPLO A', -45.3, 'expense', 'a', 'Alimentação'],
      [d('12'), 'COMBUSTIVEL EXEMPLO', -40.0, 'expense', 'a', 'Transportes'],
      [d('15'), 'RESTAURANTE EXEMPLO', -22.5, 'expense', 'a', 'Lazer'],
      [d('20'), 'SUBSCRICAO STREAMING EXEMPLO', -9.99, 'expense', 'a', 'Necessidades Básicas'],
    )
    out.push(
      [d('01'), 'TRANSFERENCIA ENTRADA EXEMPLO', 800.0, 'income', 'b', 'Receita'],
      [d('06'), 'SUPERMERCADO EXEMPLO B', -38.2, 'expense', 'b', 'Alimentação'],
      [d('14'), 'FARMACIA EXEMPLO', -12.4, 'expense', 'b', 'Saúde'],
      [d('22'), 'LOJA ROUPA EXEMPLO', -35.0, 'expense', 'b', 'Compras'],
    )
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

export class SeedRefused extends Error {}

/** Seeds one household. Returns the number of movements inserted. */
export async function seedHousehold(householdId: number, opts: { force?: boolean } = {}): Promise<number> {
  const db = getDb()
  const existing = await db.execute({ sql: `SELECT COUNT(*) AS n FROM ledger_movements WHERE household_id = ?`, args: [householdId] })
  if (Number(existing.rows[0].n) > 0 && !opts.force) {
    throw new SeedRefused(
      `O agregado já tem ${existing.rows[0].n} movimentos. O seed APAGA dados. ` +
        'Faz primeiro `npm run db:backup` e depois `npm run db:seed -- --force` se tens a certeza.',
    )
  }
  const members = await db.execute({
    sql: `SELECT user_id FROM household_members WHERE household_id = ? ORDER BY user_id LIMIT 2`,
    args: [householdId],
  })
  const ownerUser: Record<SeedOwner, number | null | undefined> = {
    a: members.rows[0] ? Number(members.rows[0].user_id) : undefined,
    b: members.rows[1] ? Number(members.rows[1].user_id) : undefined,
    conjunta: null,
  }

  const tx = await db.transaction('write')
  try {
    const account = async (owner: SeedOwner): Promise<number | null> => {
      const uid = ownerUser[owner]
      if (uid === undefined) return null
      const r = await tx.execute({
        sql: `SELECT id FROM ledger_accounts WHERE household_id = ? AND ${uid === null ? 'owner_user_id IS NULL' : 'owner_user_id = ?'} ORDER BY is_default DESC, id LIMIT 1`,
        args: uid === null ? [householdId] : [householdId, uid],
      })
      return r.rows[0] ? Number(r.rows[0].id) : null
    }
    const accounts: Record<SeedOwner, number | null> = { a: await account('a'), b: await account('b'), conjunta: await account('conjunta') }

    await tx.execute({ sql: `DELETE FROM ledger_movements WHERE household_id = ?`, args: [householdId] })
    await tx.execute({ sql: `DELETE FROM household_goals WHERE household_id = ?`, args: [householdId] })
    await tx.execute({ sql: `DELETE FROM investments WHERE household_id = ?`, args: [householdId] })

    let n = 0
    for (const [date, description, amount, kind, owner, category] of syntheticTransactions()) {
      const acc = accounts[owner]
      if (acc === null) continue
      const cents = parseAmountToCents(amount)
      if (cents === null) throw new Error(`Montante inválido no seed: ${amount}`)
      await tx.execute({
        sql: `INSERT INTO ledger_movements (household_id, account_id, booked_on, description, amount_cents, kind, category_id, source)
              VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM ledger_categories WHERE household_id = ? AND name = ?), 'seed')`,
        args: [householdId, acc, date, description, cents, kind, householdId, category],
      })
      n++
    }

    const goals: Array<[string, string, number, number, SeedOwner, string]> = [
      ['Fundo de Emergência', '🛡️', 300000, 75000, 'a', '#f97ec8'],
      ['Fundo de Emergência', '🛡️', 300000, 50000, 'b', '#6ef9a8'],
      ['Férias', '✈️', 150000, 30000, 'conjunta', '#a07ef9'],
    ]
    for (const [name, icon, target, saved, owner, color] of goals) {
      if (ownerUser[owner] === undefined) continue
      await tx.execute({
        sql: `INSERT INTO household_goals (household_id, owner_user_id, name, icon, color, target_cents, saved_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [householdId, ownerUser[owner] ?? null, name, icon, color, target, saved],
      })
    }

    // Legacy manual-investments table (REAL euros) until B4.
    const slug = async (owner: SeedOwner) => {
      const uid = ownerUser[owner]
      if (uid === undefined) return null
      if (uid === null) return 'conjunta'
      const r = await tx.execute({ sql: `SELECT slug FROM users WHERE id = ?`, args: [uid] })
      return String(r.rows[0].slug)
    }
    const inv: Array<[string, string, string, number, number, SeedOwner]> = [
      ['Corretora Exemplo', 'etf', 'ETF Exemplo', 300, 310, 'a'],
      ['PPR Exemplo', 'ppr', 'PPR Exemplo', 500, 505, 'a'],
      ['Poupança Exemplo', 'savings', 'Conta Poupança Exemplo', 1000, 1000, 'b'],
    ]
    for (const [platform, type, name, invested, current, owner] of inv) {
      const s = await slug(owner)
      if (s === null) continue
      await tx.execute({
        sql: `INSERT INTO investments (household_id, platform, type, name, invested, current_value, owner) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [householdId, platform, type, name, invested, current, s],
      })
    }
    await tx.commit()
    return n
  } catch (err) {
    await tx.rollback().catch(() => {})
    throw err
  } finally {
    tx.close()
  }
}

async function main() {
  await initDB()
  const hh = await getDb().execute(`SELECT id FROM households ORDER BY id LIMIT 1`)
  if (!hh.rows.length) {
    console.error('Não há agregado. Cria primeiro um utilizador: `npm run user -- add "Nome" email@exemplo`')
    process.exit(1)
  }
  console.log('🌱 A inserir dados sintéticos...')
  try {
    const n = await seedHousehold(Number(hh.rows[0].id), { force: process.argv.includes('--force') })
    console.log(`✅ Seed sintético completo (${n} movimentos).`)
  } catch (err) {
    if (err instanceof SeedRefused) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }
}

if (require.main === module) {
  main()
    .then(() => closeDb())
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
