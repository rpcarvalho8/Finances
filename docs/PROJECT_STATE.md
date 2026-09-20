# PROJECT_STATE

Evidence-based snapshot of **what this repository actually is**. Contrast with the target in [ARCHITECTURE.md](./ARCHITECTURE.md). Do not treat this file as a design proposal.

## One-line summary

Finance OS today is a **local-first Next.js 14 household finance dashboard** for two named people (Rui and Ana) plus a joint account, with **manual/CSV data entry**, **plaintext API-key storage**, an **unauthenticated Anthropic chat** that dumps live DB rows into the prompt, and **incomplete Open Banking prototypes**. It is not a modular multi-tenant financial operating system.

Initial commit: `170427a` (2026-06-09). Phase 0 docs landed on `main` as `fed1990`. On **2026-09-20** (SEC-D01 option 1 + SEC-D02) the committed Enable Banking PEM and `local.db` were **removed from HEAD** in a forward commit. **Git history still contains both files** at `170427a` until an optional future purge. The Enable Banking application key **must be rotated** in the provider console (SEC-004); treat the old UUID as burned.

## Product surface (real routes)

| Route | File | What it does |
| --- | --- | --- |
| `/` | `app/page.tsx` | Server Component dashboard: queries `transactions` (current calendar month), `investments`, `goals` **directly from SQLite**. Cards for Rui / Ana / Conta Conjunta. |
| `/rui` | `app/rui/page.tsx` | Client page: `/api/transactions?owner=rui`, `/api/goals?owner=rui`. Hardcoded salary `INCOME = 1159.30` and 50/13/12/10/10/5 budget percents. CSV import `owner="rui"`. |
| `/ana` | `app/ana/page.tsx` | Same pattern with `owner=ana`, hardcoded `INCOME = 301.18` and “novo salário” 601.18 → 300 joint / 301 personal. |
| `/conjunta` | `app/conjunta/page.tsx` | `owner=conjunta` transactions; goals `owner=familia`. Hardcoded `INCOME = 650` and housing line items (loan, condomínio, Zurich, Vodafone, …). |
| `/investimentos` | `app/investimentos/page.tsx` | Manual portfolio CRUD. Sidebar points here. |
| `/investments` | `app/investments/page.tsx` | Near-duplicate English UI; **not in the sidebar**. |
| `/ai-advisor` | `app/ai-advisor/page.tsx` | Chat UI; POSTs `{question}` to `/api/ai-advisor`. |
| `/settings` | `app/settings/page.tsx` | API key forms, budget numbers, DB backup download, “Conectar Conta Bancária” → `/api/sync/bank/init`. |
| `/finance` | `app/finance/page.tsx` | Fetches **`/api/finances` which does not exist**. Stats hardcoded to `fmt(0)`. Not linked in `components/Sidebar.tsx`. |
| `/lumeu` | `app/lumeu/page.tsx` | LUMEU expense tracker. Duplicate of `components/BusinessPages/LumeuPage.tsx` (both 120 lines). Not in sidebar. |
| `/business/[slug]` | `app/business/[slug]/page.tsx` | Maps `lumeu` / `trade` / `condoflow` to components. Unknown slugs render “Negócio não encontrado”. |

Sidebar (`components/Sidebar.tsx`) also loads `/api/business` and lets anyone POST a new business name.

### Business pages

| Slug | Component | Data |
| --- | --- | --- |
| `lumeu` | `components/BusinessPages/LumeuPage.tsx` | Real `/api/lumeu` CRUD against `lumeu_expenses`. |
| `trade` | `components/BusinessPages/TradePage.tsx` | **Mock** Recharts series (prop firms, forex, crypto). No API. No “Trading OS” string. |
| `condoflow` | `components/BusinessPages/CondoFlowPage.tsx` | **Mock** quotas/reserve after `setTimeout`. |

`lib/db.ts` seeds businesses `lumeu`, `condoflow`, `trade` if the table is empty.

## API surface (real)

All handlers live under `app/api/**/route.ts`. **None check authentication.**

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | `SELECT 1` |
| GET/POST | `/api/transactions` | Filter by `owner` / `month`; insert with `owner` string |
| PUT/DELETE | `/api/transactions/[id]` | Update/delete by id, no ownership check |
| GET/POST | `/api/investments` | List / insert (`owner` default `'rui'`) |
| PUT/DELETE | `/api/investments/[id]` | Update value / delete |
| GET | `/api/investments/sync` | Returns whether `api_keys.api_key` is non-empty. **Does not call brokers.** |
| GET/POST | `/api/goals` | `owner` filter; special-case `owner='familia'` |
| PUT/DELETE | `/api/goals/[id]` | Soft-delete sets `active=0` |
| GET/POST | `/api/lumeu` | Business expenses |
| DELETE | `/api/lumeu/[id]` | Hard delete |
| GET/POST | `/api/business` | List/create businesses |
| POST/GET | `/api/settings/api-keys` | Stores platform keys in `api_keys` **plaintext** |
| POST/GET | `/api/settings/budgets` | JSON blob in `api_keys` row `platform='__budgets__'` |
| POST | `/api/import` | Semicolon CSV; heuristic categorizer |
| GET | `/api/backup` | Streams the SQLite file as a download |
| POST | `/api/ai-advisor` | Loads DB rows, builds system prompt, calls Anthropic |
| POST | `/api/sync/bank/init` | Enable Banking JWT + ASPSP body |
| GET | `/api/sync/bank/callback` | Token exchange, writes `bank_accounts` + transactions as `owner='rui'` |

Missing but referenced: **`/api/finances`**.

## Auth & identity (real)

**There is no login, session, cookie, JWT-for-users, or middleware.**

Evidence:

- `users` table is created in `lib/db.ts` (`password_hash`, `role`) but **never inserted or queried**.
- `.env.example` defines `AUTH_SECRET`, `RUI_PASSWORD`, `ANA_PASSWORD`. **No TypeScript file reads these names** (repo-wide grep).
- Ownership is a **free-text column** `owner` with values used in UI/API/seed: `'rui' | 'ana' | 'conjunta' | 'familia' | 'all'`.
- Dashboard people cards are hardcoded (`href:'/rui'`, `'/ana'`, `'/conjunta'`).
- Layout description: `'Gestão financeira familiar — Rui & Ana'`.

Anyone who can reach the process can read/write all household and business data.

## Data entry (real)

1. **Seed** (`scripts/seed.ts`): wipes/reinserts accounts, categories, investments, goals, and many 2026-01..03 transactions for `rui` and `conjunta` (no Ana personal txns in the seed loop). Contains salary/employer/merchant strings that look like real household data.
2. **Manual forms** (`AddTransactionForm` in `components/UI.tsx`).
3. **CSV import** (`ImportCSV` + `/api/import`): `;` separated, Portuguese bank-style dates, keyword categorizer (EMERGENT→LUMEU, XTB/BYBIT→Investimentos, etc.). `papaparse` unused.
4. **Open Banking callback** (if credentials work): inserts bank txns with hardcoded `owner='rui'` and `account_id=1`.

## Providers (real vs placeholder)

See also [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md). Short table:

| Provider | Exists in repo? |
| --- | --- |
| ActivoBank | Seed `bank='activobank'` for Rui; CSV default bank; Enable Banking / GoCardless **placeholder institution IDs** |
| ABANCA | Seed joint + Ana accounts `bank='abanca'`; CSV bank for `conjunta`; placeholder IDs |
| Revolut | **No references** |
| XTB | Seed position + settings fields + env names. **No XTB API client** |
| OKX | **No references** |
| Exodus | **No references** |
| Kraken | **No references** |
| IBKR | Seed position + TWS host/port fields. **No TWS/IBKR client** |
| Bybit | Seed crypto bag + key fields. **No Bybit client** |
| Binance | Settings/env only. **No client**, no seed row |
| Trading212 | Settings/env only. **No client** |
| PPR (NB) / PoupeUp | Seed/manual investment rows only |

`/api/investments/sync` only reports key presence.

## Open Banking / PSD2 (real)

Two parallel sketches plus one wired UI button:

1. **Wired:** Settings button → `POST /api/sync/bank/init` (JWT RS256 using `ENABLE_BANKING_APPLICATION_SECRET` or `ENABLE_BANKING_PRIVATE_KEY_PATH`; **fails closed** if application key, redirect URI, or private key env is missing) → user redirect → `GET /api/sync/bank/callback`.
2. **Unwired module:** `app/lib/enablebanking.ts` (throws at import if env missing; talks about `bank_requisitions` / `bank_balances` tables **not created by `initDB`**). **No other file imports it.**
3. **Unwired module:** `app/lib/gocardless.ts` (Nordigen `ob.nordigen.com`; same missing tables; throws at import). **No other file imports it.**

The previously committed `.pem` is **absent from HEAD** (still in history at `170427a`). Init no longer hardcodes the burned application UUID or a `loca.lt` redirect. Bank connect will not work until a human rotates credentials in the Enable Banking console and sets env vars (SEC-004).

Consent UX is a single “connect bank” button. No per-account consent store in `initDB`. Callback stores **access_token in SQLite** (`bank_accounts.access_token`) and assigns all imported txns to `rui`.

## AI (real)

`app/api/ai-advisor/route.ts`:

- Instantiates Anthropic with `process.env.ANTHROPIC_API_KEY`.
- **The route itself queries SQLite** (transactions this month, all investments, active goals, last 20 lumeu expenses).
- Builds a Portuguese system prompt including **hardcoded salaries**, portfolio lines, goal progress, and last 12 transaction **descriptions and amounts**.
- Sends `question` as the user message. **No redaction, no allowlist, no tool-calling gateway, no instruction that the model cannot execute money-moving operations** (there are also no execution tools — the model only returns text).
- Endpoint is unauthenticated.

This is the opposite of the target “AI never has direct DB access; Context Engine + Gateway sit in front.”

## Trading OS

**No code or docs mention “Trading OS”.** Closest artifacts:

- Mock `TradePage` charts (prop firm / forex / crypto).
- `test-init.js` sample category “Trading Forex” and a comment about “Ganho Prop Firm FTMO”.
- Seed Bybit/XTB/IBKR **manual balances**, not live trading payloads.

Finance OS does **not** currently receive aggregated trading payloads from a sibling system.

## Quality bar (scripts / tests / build)

| Check | Exists? | Result in Phase 0 environment |
| --- | --- | --- |
| Unit/e2e tests | No | N/A |
| ESLint | No | N/A |
| `npm run typecheck` | No | Manual `npx tsc --noEmit` used instead |
| `npm run build` | Yes | See below |
| `npm run db:init` | Script yes, file no | Fails: `scripts/init-db.ts` missing |
| `npm run db:seed` | Yes | Not executed against production data in Phase 0 (would DELETE/INSERT household rows) |

`tsconfig.json` has `"strict": false`. Widespread `any` in pages.

`app/lib/db-server.ts` duplicates the libsql client and is **never imported**.

`app/finance/actions.ts` is **never imported**. It writes `personal_transactions` and reads `bank_requisitions` / `bank_balances` — tables **not** in `initDB()`.

### Typecheck / build notes (executed in Phase 0)

After `npm install --legacy-peer-deps`:

- `npx tsc --noEmit` → **exit 0** (TypeScript `strict` is false; this is a weak bar).
- `npm run db:init` → **exit 1**, missing `scripts/init-db.ts`.
- `npm run build` → webpack **compile succeeded**, then failed while collecting page data for `/api/goals`: libsql `Failed to connect to database: ./data/finance.db` because `createClient()` runs at import in `lib/db.ts` and `data/` is empty on a clean tree. Also: `Invalid next.config.js options`: unrecognized `serverExternalPackages` on Next 14.2.3.

**Do not treat “tsc passed” as production-ready.** Runtime still needs a DB created with `initDB()`/`seed.ts`. That file is **not** the committed `local.db`. Build-001 in the backlog covers lazy-connecting the client.

## Legacy / duplicate / inconsistent code

| Issue | Evidence |
| --- | --- |
| Dual investment UIs | `/investimentos` vs `/investments` |
| Dual LUMEU UIs | `/lumeu` vs `/business/lumeu` (byte-identical page vs component) |
| Dual DB clients | `lib/db.ts` vs unused `app/lib/db-server.ts` |
| Dual DB files/schemas | `data/finance.db` (intended) vs historically committed `local.db` (test-init schema; **removed from HEAD 2026-09-20**, still in git history at `170427a`) |
| Dual Open Banking stacks | Enable Banking routes vs unused Enable Banking lib vs unused GoCardless lib |
| Dual transaction models | `transactions` (used) vs `personal_transactions` (actions only) |
| Dual ID types | INTEGER AUTOINCREMENT in `lib/db.ts` vs TEXT PK in `local.db` / `test-init.js` |
| Dual goals columns | `saved` (`lib/db.ts`) vs `current` (`local.db`) |
| Person-named routes | `/rui`, `/ana` instead of `/users/:id` or household members |
| Unused npm deps | `papaparse`, `zod`, `date-fns` (no app imports) |
| Dead page | `/finance` + missing `/api/finances` |
| Port mismatch | `package.json` `next dev -p 3002` vs settings UI “localhost:3000” vs setup script “http://localhost:3000” |
| `initDB` never called by the app | Only `scripts/seed.ts` calls it. Next server assumes tables already exist. |

## What works as a household tool (preserve)

If a human runs `scripts/setup-ubuntu.sh` or `npm run db:seed` against `file:./data/finance.db`, the **Rui / Ana / Conjunta / Investimentos / LUMEU / AI Advisor / Settings** UI is a coherent local dashboard: list transactions, add rows, import CSV, track goals, store (manual) portfolio lines, chat with Claude about this month.

That working slice should be **preserved** while later phases introduce users/households, adapters, and an AI gateway.
