'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

/**
 * Create a new personal transaction from FormData.
 * After insertion, revalidate the /finance path to refresh UI.
 */
export async function createTransaction(formData: FormData) {
  const description = formData.get('description') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const type = formData.get('type') as 'expense' | 'income';
  const accountOwner = formData.get('account_owner') as
    | 'rui_personal'
    | 'ana_personal'
    | 'conjunta_abanca';
  const categoryId = parseInt(formData.get('category_id') as string, 10);

  if (
    !description ||
    isNaN(amount) ||
    !type ||
    !accountOwner ||
    isNaN(categoryId)
  ) {
    throw new Error('Invalid form data');
  }

  await db.execute({
    sql: `
    INSERT INTO personal_transactions
      (description, amount, type, account_owner, category_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    args: [description, amount, type, accountOwner, categoryId]
  });

  revalidatePath('/finance');
}

/**
 * Fetch all bank requisitions (connection status).
 * Returns an array of { bank_name: string, status: string }.
 */
export async function getBankConnections() {
  const result = await db.execute(
    `SELECT bank_name, status FROM bank_requisitions ORDER BY bank_name`
  );
  return result.rows as any as Array<{ bank_name: string; status: string }>;
}

/**
 * Fetch the latest balance for each bank.
 * Returns an array of { bank_name: string, balance: number }.
 */
export async function getBankBalances() {
  const result = await db.execute(
    `SELECT bank_name, balance FROM bank_balances ORDER BY bank_name`
  );
  return result.rows as any as Array<{ bank_name: string; balance: number }>;
}