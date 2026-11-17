import type { Transaction } from '@libsql/client'

/** Generic default categories created for every new household. */
export const DEFAULT_CATEGORIES: Array<[name: string, icon: string, color: string, kind: string, budgetPct: number]> = [
  ['Receita', '💵', '#6ef9a8', 'income', 0],
  ['Habitação', '🏠', '#7eb8f9', 'expense', 35],
  ['Alimentação', '🛒', '#c8f97e', 'expense', 20],
  ['Utilidades', '💡', '#f9c67e', 'expense', 12],
  ['Transportes', '🚗', '#f9c67e', 'expense', 10],
  ['Lazer', '🎭', '#a07ef9', 'expense', 8],
  ['Saúde', '❤️', '#f97ec8', 'expense', 0],
  ['Compras', '🛍️', '#f96e6e', 'expense', 0],
  ['Necessidades Básicas', '📱', '#f9f97e', 'expense', 0],
  ['Educação', '📚', '#f9f97e', 'expense', 0],
  ['Família', '👨‍👩‍👦', '#ff9fb2', 'expense', 0],
  ['Investimentos', '📈', '#6ef9a8', 'investment', 0],
  ['Poupança', '💰', '#5ef0d8', 'savings', 0],
  ['Transferências', '↔️', '#888888', 'transfer', 0],
  ['Outros', '📦', '#666666', 'expense', 0],
]

/** Idempotent: default categories and the joint default account. */
export async function ensureHouseholdDefaults(tx: Transaction, householdId: number): Promise<void> {
  for (const [name, icon, color, kind, pct] of DEFAULT_CATEGORIES) {
    await tx.execute({
      sql: `INSERT OR IGNORE INTO ledger_categories (household_id, name, icon, color, kind, budget_pct) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [householdId, name, icon, color, kind, pct],
    })
  }
  await tx.execute({
    sql: `INSERT INTO ledger_accounts (household_id, owner_user_id, name, kind, is_default)
          SELECT ?, NULL, 'Conta conjunta', 'checking', 1
          WHERE NOT EXISTS (SELECT 1 FROM ledger_accounts WHERE household_id = ? AND owner_user_id IS NULL AND is_default = 1)`,
    args: [householdId, householdId],
  })
}

/** Idempotent: the member's personal default account. */
export async function ensureMemberDefaults(tx: Transaction, householdId: number, userId: number): Promise<void> {
  await tx.execute({
    sql: `INSERT INTO ledger_accounts (household_id, owner_user_id, name, kind, is_default)
          SELECT ?, ?, 'Conta pessoal', 'checking', 1
          WHERE NOT EXISTS (SELECT 1 FROM ledger_accounts WHERE household_id = ? AND owner_user_id = ? AND is_default = 1)`,
    args: [householdId, userId, householdId, userId],
  })
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Reserved for the joint view. */
export const JOINT_VIEW = 'conjunta'
