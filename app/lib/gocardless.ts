import { db } from '@/lib/db';

const NORDIGEN_BASE = 'https://ob.nordigen.com/api/v2';
const SECRET_ID = process.env.GOCARDLESS_SECRET_ID;
const SECRET_KEY = process.env.GOCARDLESS_SECRET_KEY;

if (!SECRET_ID || !SECRET_KEY) {
  throw new Error('Missing GoCardless (Nordigen) credentials in env');
}

/**
 * Obtain an access token from Nordigen (cached in-memory for simplicity).
 * In a production app you would store/refresh the token securely.
 */
let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_accessToken && now < _tokenExpiresAt - 30_000) {
    return _accessToken; // still valid with 30s safety margin
  }
  const res = await fetch(`${NORDIGEN_BASE}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: SECRET_ID, secret_key: SECRET_KEY }),
  });
  if (!res.ok) throw new Error(`Nordigen token error: ${await res.text()}`);
  const data = await res.json();
  _accessToken = data.access;
  // Nordigen tokens live 60 min; we store the expiry in ms
  _tokenExpiresAt = now + Number(data.expires_in) * 1000;
  return _accessToken;
}

/**
 * Map the friendly bank names used in Finance OS to Nordigen institution IDs.
 * Replace the placeholder values with the actual IDs from Nordigen for your banks.
 */
const BANK_TO_INSTITUTION: Record<string, string> = {
  'ActivoBank Rui': 'ACTIVOBANK_IE',   // placeholder – replace with actual Nordigen ID
  'ActivoBank Ana': 'ACTIVOBANK_IE',
  'Abanca Conjunta': 'ABANCA_ES',
};

/**
 * Step 1 – create a requisition and return the URL where the user must authorize.
 */
export async function getAuthLink(
  bankName: string,
  redirectUrl: string
): Promise<string> {
  const institutionId = BANK_TO_INSTITUTION[bankName];
  if (!institutionId) {
    throw new Error(`Unsupported bank: ${bankName}`);
  }

  const accessToken = await getAccessToken();
  const res = await fetch(`${NORDIGEN_BASE}/requisitions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create requisition: ${await res.text()}`);
  }
  const data = await res.json();
  // Store a pending requisition so we can later match the callback
  const clientId = crypto.randomUUID(); // or use data.id if you prefer
  await db.execute({
    sql: `
    INSERT INTO bank_requisitions (id, bank_name, status, requisition_id, created_at)
    VALUES (?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)
    `,
    args: [clientId, bankName, data.id]
  });
  // Nordigen returns a link the user must visit
  return data.link;
}

/**
 * Step 2 – after the bank redirects back, fetch balances (and optionally transactions)
 * and persist them.
 */
export async function syncBankTransactions(
  requisitionId: string
): Promise<void> {
  const accessToken = await getAccessToken();

  // 1️⃣ Get the accounts linked to this requisition
  const accountsRes = await fetch(
    `${NORDIGEN_BASE}/requisitions/${requisitionId}/`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!accountsRes.ok) {
    throw new Error(`Cannot fetch requisition: ${await accountsRes.text()}`);
  }
  const requisitionData = await accountsRes.json();
  const accountIds: string[] = requisitionData.accounts ?? [];

  if (accountIds.length === 0) {
    throw new Error('No accounts found for requisition');
  }

  // For simplicity we assume one account per requisition (matches our UI)
  const accountId = accountIds[0];

  // 2️⃣ Fetch balances
  const balancesRes = await fetch(
    `${NORDIGEN_BASE}/accounts/${accountId}/balances/`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!balancesRes.ok) {
    throw new Error(`Cannot fetch balances: ${await balancesRes.text()}`);
  }
  const balancesData = await balancesRes.json();

  // Nordigen returns an array of balance objects; we pick the first "closing_booked"
  const balanceObj =
    balancesData.balances?.find((b: any) => b.balanceType === 'closing_booked') ??
    balancesData.balances?.[0];
  const balance = parseFloat(balanceObj.balanceAmount.amount);
  const currency = balanceObj.balanceAmount.currency ?? 'USD';

  // 3️⃣ Update or insert the mirror balance – need bank_name from requisition
  const result = await db.execute({
    sql: `SELECT bank_name FROM bank_requisitions WHERE requisition_id = ?`,
    args: [requisitionId]
  });
  const [{ bank_name }] = result.rows as any as Array<{ bank_name: string }>;

  await db.execute({
    sql: `
    INSERT INTO bank_balances (bank_name, balance, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(bank_name) DO UPDATE SET
      balance = excluded.balance,
      updated_at = CURRENT_TIMESTAMP
    `,
    args: [bank_name, balance]
  });

  // 4️⃣ (Optional) fetch recent transactions and store them in a separate table
  //    – omitted here to keep the example focused, but you can call:
  //    `${NORDIGEN_BASE}/accounts/${accountId}/transactions/` and persist.
}

/**
 * Mark a requisition as ACTIVE after successful callback.
 */
export async function activateRequisition(
  requisitionId: string
): Promise<void> {
  await db.execute({
    sql: `UPDATE bank_requisitions SET status = 'ACTIVE' WHERE requisition_id = ?`,
    args: [requisitionId]
  });
}