import { db } from '@/lib/db';

/* --------------------------------------------------------------
   Configuration – replace the placeholder URLs with the ones
   provided by Enable Banking for your environment (sandbox / prod)
   -------------------------------------------------------------- */
const ENABLE_BANKING_BASE = 'https://api.enablebanking.com';
const AUTH_ENDPOINT = `${ENABLE_BANKING_BASE}/oauth/authorize`;
const TOKEN_ENDPOINT = `${ENABLE_BANKING_BASE}/oauth/token`;
const AGREEMENTS_ENDPOINT = `${ENABLE_BANKING_BASE}/agreements`;
const ACCOUNTS_ENDPOINT = (agreementId: string) =>
  `${AGREEMENTS_ENDPOINT}/${agreementId}/accounts`;
const BALANCES_ENDPOINT = (accountId: string) =>
  `/accounts/${accountId}/balances`; // relative to API base

const APPLICATION_KEY = process.env.ENABLE_BANKING_APPLICATION_KEY;
const APPLICATION_SECRET = process.env.ENABLE_BANKING_APPLICATION_SECRET;

if (!APPLICATION_KEY || !APPLICATION_SECRET) {
  throw new Error(
    'Missing Enable Banking credentials – set ENABLE_BANKING_APPLICATION_KEY and ENABLE_BANKING_APPLICATION_SECRET'
  );
}

/* --------------------------------------------------------------
   Simple in‑memory token cache (for demo purposes). In production
   you would store the token securely (encrypted cookie, DB, etc.)
   -------------------------------------------------------------- */
let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

async function getApplicationToken(): Promise<string> {
  const now = Date.now();
  if (_accessToken && now < _tokenExpiresAt - 30_000) {
    return _accessToken; // still valid with 30s safety margin
  }
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: APPLICATION_KEY,
      client_secret: APPLICATION_SECRET,
      scope: 'ais', // Account Information Service scope
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Enable Banking token error: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  _accessToken = data.access_token;
  // expires_in is usually in seconds
  _tokenExpiresAt = now + Number(data.expires_in) * 1000;
  return _accessToken;
}

/* --------------------------------------------------------------
   Map the friendly bank names used in Finance OS to the
   provider IDs that Enable Banking expects.
   Replace the placeholder values with the real IDs from the
   Enable Banking provider list (sandbox or production).
   -------------------------------------------------------------- */
const BANK_TO_PROVIDER: Record<string, string> = {
  'ActivoBank Rui': 'activobank_activobankpt',   // <-- replace with actual Provider ID
  'ActivoBank Ana': 'activobank_activobankpt',
  'Abanca Conjunta': 'abanca_abancapt',
};

/* --------------------------------------------------------------
   Step 1 – build the URL where the user must give consent.
   We store a pending requisition (agreement) so we can later
   match the callback.
   -------------------------------------------------------------- */
export async function getAuthLink(
  bankName: string,
  redirectUrl: string
): Promise<string> {
  const providerId = BANK_TO_PROVIDER[bankName];
  if (!providerId) {
    throw new Error(`Unsupported bank for Enable Banking: ${bankName}`);
  }

  // Generate a random state to mitigate CSRF
  const state = crypto.randomUUID();

  // Create a pending agreement entry (we will fill the real agreement_id later)
  const pendingId = crypto.randomUUID(); // our internal id
  await db.execute({
    sql: `
    INSERT INTO bank_requisitions (id, bank_name, status, requisition_id, created_at)
    VALUES (?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)
    `,
    args: [pendingId, bankName, state]
  });

  // Build the Enable Banking authorization URL
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', APPLICATION_KEY);
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', 'ais');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('provider', providerId); // tells EB which bank

  return authUrl.toString();
}

/* --------------------------------------------------------------
   Step 2 – after the bank redirects back, we receive:
     - code   (authorization code)
     - state  (the value we originally set, stored as requisition_id)
   We exchange the code for a token, then fetch the agreement
   to get the accountId, then fetch the first booked balance and
   upsert it into `bank_balances`.
   -------------------------------------------------------------- */
export async function syncBankTransactions(
  requisitionId: string
): Promise<void> {
  /*
     `requisitionId` in our DB actually holds the *state* we stored
     during getAuthLink. The callback will give us the matching
     `state` and the `code` from Enable Banking.
  */
  // 1️⃣ Retrieve the pending agreement to get bank_name and state
  const result = await db.execute({
    sql: `SELECT bank_name, status FROM bank_requisitions WHERE requisition_id = ?`,
    args: [requisitionId]
  });
  const [{ bank_name, status }] = result.rows as any as Array<{ bank_name: string; status: string }>;

  if (status !== 'PENDING') {
    throw new Error(`Requisition ${requisitionId} is not PENDING`);
  }

  // The callback handler must have already exchanged the code for a token
  // and stored it somewhere. For simplicity we re‑fetch an application token
  // (Enable Banking allows using an application token to access an agreement
  // once the user has granted consent). If you prefer to store the user
  // token, adjust this part accordingly.
  const accessToken = await getApplicationToken();

  // 2️⃣ Get the agreement details to obtain the account ID
  const agreementRes = await fetch(
    `${AGREEMENTS_ENDPOINT}/${requisitionId}`, // NOTE: Enable Banking uses the agreement id as the "requisition_id" we stored
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!agreementRes.ok) {
    throw new Error(
      `Cannot fetch agreement: ${agreementRes.status} ${await agreementRes.text()}`
    );
  }
  const agreementData = await agreementRes.json();
  // The agreement may contain multiple accounts; we take the first one.
  const accountId = agreementData.accounts?.[0]?.id;
  if (!accountId) {
    throw new Error('No account found in the agreement');
  }

  // 3️⃣ Fetch balances for that account
  const balancesRes = await fetch(
    `${ENABLE_BANKING_BASE}${BALANCES_ENDPOINT(accountId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!balancesRes.ok) {
    throw new Error(
      `Cannot fetch balances: ${balancesRes.status} ${await balancesRes.text()}`
    );
  }
  const balancesData = await balancesRes.json();

  // Enable Banking returns an array of balance objects; pick the first "closing_booked"
  const balanceObj =
    balancesData.balances?.find((b: any) => b.balanceType === 'closing_booked') ??
    balancesData.balances?.[0];
  const balance = parseFloat(balanceObj.balanceAmount.amount);
  const currency = balanceObj.balanceAmount.currency ?? 'USD';

  // 4️⃣ Upsert the mirror balance (same as before)
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

  // 5️⃣ Mark the requisition as ACTIVE so the UI shows a green indicator
  await db.execute({
    sql: `UPDATE bank_requisitions SET status = 'ACTIVE' WHERE requisition_id = ?`,
    args: [requisitionId]
  });
}