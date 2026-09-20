# DATABASE_AUDIT

Sources of schema in this repo, how they disagree, and what is actually used.

## Intended connection

`.env.example`:

```
DATABASE_URL=file:./data/finance.db
```

`lib/db.ts` and `app/lib/db-server.ts`:

```ts
export const db = createClient({
  url: process.env.DATABASE_URL || 'file:./data/finance.db',
})
```

`.gitignore` ignores `data/*.db` and `data/*.db-journal`. The `data/` directory is **not** in git. A fresh clone has **no** `finance.db` until seed/setup runs.

`package.json` `"db:init": "tsx scripts/init-db.ts"` — **`scripts/init-db.ts` does not exist** (confirmed: `ERR_MODULE_NOT_FOUND` on `npm run db:init`). Initialization that works is `scripts/seed.ts` calling `initDB()`.

## Migrations

**There are no migration files, no migration runner, no version table.** Schema evolution is:

1. `CREATE TABLE IF NOT EXISTS` in `initDB()` (`lib/db.ts`) — will **not** add new columns to an existing table.
2. Ad-hoc `CREATE TABLE IF NOT EXISTS bank_accounts` inside `app/api/sync/bank/callback/route.ts`.
3. `test-init.js` creating a **different** schema in `file:local.db`.

## Canonical schema (`lib/db.ts` `initDB`)

Quoted/summarized from `lib/db.ts`:

| Table | PK | Notable columns |
| --- | --- | --- |
| `users` | INTEGER AUTOINCREMENT | `name`, `email UNIQUE`, `password_hash`, `role` default `'member'` |
| `accounts` | INTEGER AUTOINCREMENT | `name`, **`owner TEXT NOT NULL`**, `bank`, `type` default `'checking'`, `balance`, `currency` default `'EUR'`, `color`, `active` |
| `categories` | INTEGER AUTOINCREMENT | `name`, `icon`, `color`, `type`, **`owner` default `'all'`**, `budget_pct`, `is_business` |
| `transactions` | INTEGER AUTOINCREMENT | `account_id` default 1, `date`, `description`, `amount REAL`, `category_id`, `subcategory`, `type`, **`owner TEXT NOT NULL`**, `notes`, `import_id` |
| `investments` | INTEGER AUTOINCREMENT | `platform`, `type`, `name`, `symbol`, qty/prices, `invested`, `current_value`, **`owner` default `'rui'`** |
| `goals` | INTEGER AUTOINCREMENT | `name`, `target`, **`saved`**, `deadline`, **`owner` default `'rui'`**, `active` |
| `api_keys` | INTEGER AUTOINCREMENT | `platform UNIQUE`, `api_key`, `api_secret`, `extra`, `active`, `last_sync` |
| `lumeu_expenses` | INTEGER AUTOINCREMENT | `transaction_id`, `date`, `description`, `amount`, `category`, `vendor`, `receipt_url` |
| `businesses` | TEXT PK | `name`, `slug UNIQUE`; seed rows lumeu / condoflow / trade if empty |

Indexes: `idx_txn_date`, `idx_txn_owner`.

**Not created here but referenced in code:**

| Table | Referenced by |
| --- | --- |
| `personal_transactions` | `app/finance/actions.ts` (`account_owner` in `'rui_personal' \| 'ana_personal' \| 'conjunta_abanca'`) |
| `bank_requisitions` | `app/lib/enablebanking.ts`, `app/lib/gocardless.ts`, `getBankConnections()` |
| `bank_balances` | same libs + `getBankBalances()` |
| `bank_accounts` | created in bank callback (`id TEXT PK`, `iban`, `access_token`, …) |

`users` is created and then unused.

## Seed data (`scripts/seed.ts`)

Destructive: `DELETE FROM accounts|categories|investments|goals` and `DELETE FROM transactions WHERE owner in ('rui','conjunta')`.

Accounts:

- Conta Pessoal Rui / `rui` / `activobank` / balance `156.24`
- Conta Conjunta / `conjunta` / `abanca` / `0`
- Conta Pessoal Ana / `ana` / `abanca` / `0`

Investments (all `owner='rui'`): XTB, Interactive Brokers, Bybit, PPR (NB), PoupeUp.

Goals: mixed `rui` / `ana` / `familia`.

Transactions: many 2026-01..03 rows with employer and merchant descriptions (PII/financial — do not copy wholesale into tickets). **No Ana personal transaction loop** (only rui + conjunta).

## Committed `local.db` (legacy / experimental)

Git-tracked file at repo root, 57 344 bytes. Created/shaped by `test-init.js` (`createClient({ url: 'file:local.db' })`).

**This is not the `initDB()` schema.** Differences that will break `app/page.tsx` / API SQL if `DATABASE_URL` pointed here:

| Topic | `lib/db.ts` | `local.db` |
| --- | --- | --- |
| PK type | INTEGER AUTOINCREMENT | TEXT |
| `transactions.amount` sign | signed (expenses negative in seed/UI) | test rows are positive income |
| `transactions.type` | free TEXT (`income`,`expense`,`investment`,`savings`,…) | CHECK `IN ('income','expense')` |
| `transactions` extras | `account_id`, `owner` NOT NULL, `import_id`, … | optional `owner`; no `account_id` |
| `goals` progress column | `saved` | `current` |
| `investments` | platform/type/name/invested/current_value | name/type/`balance`/`invested` |
| `users` / `accounts` / `api_keys` | yes | **no** |
| `categories.id` | integer | `'1'`, `'2'` (Trading Forex, Crypto) |
| `businesses` | uuid-like ids from seed (`lumeu`, …) | `b1/b2/b3` plus extra `type` column |

Row counts observed in the committed file: businesses 3, categories 2, goals 1 (`owner='Rui'`), investments 0, lumeu_expenses 0, transactions 4.

**`.gitignore` does not list `local.db` or `*.db` at repo root** — only `data/*.db`.

## Runtime schema drift

Bank callback:

```sql
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  iban TEXT,
  bank TEXT NOT NULL,
  name TEXT NOT NULL,
  balance REAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  access_token TEXT,
  last_sync TEXT,
  updated_at TEXT
)
```

Then `DELETE FROM bank_accounts` on every successful OAuth (wipes all banks). Tokens stored in cleartext. Transactions inserted into the **household** `transactions` table with `account_id = 1` and `owner = 'rui'` regardless of which bank account they came from.

## Dual clients

| File | Used? |
| --- | --- |
| `lib/db.ts` | Yes — almost all routes + dashboard + seed |
| `app/lib/db-server.ts` | **No imports** |

Both create a client at **module load**. Next.js may instantiate this in serverless/server contexts; there is no connection pooling configuration, no encryption-at-rest.

## Integrity issues (application-level)

- CSV import dedupes on `(date, description, amount, owner)` not `import_id`.
- Bank callback sets `import_id` to `enable_${account.id}_${txn.transactionId}` but **does not check uniqueness** before insert (table has no UNIQUE on `import_id`).
- `amount` sign convention: forms negate expenses; bank callback uses `Math.abs(amount)` then type income/expense — dashboard filters `amount > 0` vs `< 0`, so bank expenses stored as **positive** with `type='expense'` would be counted as **income** on the home page.
- Goals API: `AND (owner=? OR owner='familia')` when `owner` query param is set — Ana’s page therefore also receives family goals.
- No foreign keys declared (`account_id`, `category_id` are unconstrained).
- No `household_id` / `user_id` integer FKs.

## DATABASE_URL risks

- Default relative `file:./data/finance.db` depends on **process cwd**. Next `next dev` vs `next start` vs systemd can point at different files.
- `test-init.js` always uses `file:local.db` ignoring `DATABASE_URL`.
- Backup route: `DATABASE_URL.replace('file:','')` then `fs.readFileSync` — if someone later sets a remote `libsql://` URL this becomes a path traversal / crash, not a proper backup.

## Recommendation (Phase 0 only — not implemented)

Human must pick **one** source of truth (Decision DB-001):

1. Keep `lib/db.ts` as canonical; delete or gitignore `local.db`; add a real `scripts/init-db.ts` that only runs `initDB()`; introduce proper migrations **later**.
2. Do **not** point the Next app at `local.db`.

Remediation of committed DB file is **blocked on approval** (may contain household figures; rewriting history may be required). See [DECISIONS.md](./DECISIONS.md) and [BACKLOG.md](./BACKLOG.md) SEC-002 / DB-001.
