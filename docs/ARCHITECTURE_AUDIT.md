# ARCHITECTURE_AUDIT

Real system vs the **target** Finance OS (target is specified for comparison only; Phase 0 does not implement it).

## Real architecture (as coded)

```
Browser (no auth)
  → Next.js App Router pages (mostly Client Components + fetch)
  → Route Handlers in app/api/**  OR  Server Components importing @/lib/db
       → @libsql/client
            → SQLite file (DATABASE_URL or file:./data/finance.db)
```

There is **no** Application Service layer, **no** Domain layer, **no** Repository abstraction, **no** provider adapter interface.

A second unused path exists:

```
app/finance/actions.ts  ('use server')
  → INSERT personal_transactions / SELECT bank_requisitions, bank_balances
```

Those tables are **not** created in `lib/db.ts` `initDB()`, and `app/finance/page.tsx` does not call these actions.

### Layer mapping

| Target layer | Real equivalent |
| --- | --- |
| UI | `app/**/page.tsx`, `components/*` (inline styles + some Tailwind on mock business pages) |
| API / Server Actions | Mix of Route Handlers (used) and one unused `actions.ts` |
| Application services | **Absent** — SQL is inlined in routes and pages |
| Domain | **Absent** — `owner` strings and hardcoded EUR amounts in UI |
| Repositories | **Absent** — `db.execute({sql, args})` everywhere |
| Database | libSQL/SQLite; schema via `CREATE TABLE IF NOT EXISTS` in `initDB()` plus ad-hoc `CREATE` in bank callback |

### Control flow oddities

- Home dashboard (`app/page.tsx`) is a Server Component that queries the DB at render time (`export const dynamic = 'force-dynamic'`). Person pages are Client Components that call APIs. Same data, two access styles.
- `initDB()` is only invoked from `scripts/seed.ts`. The running Next app **does not auto-migrate**.
- Bank callback creates `bank_accounts` at request time, separate from `accounts`.

## Target domain coverage

Legend: **Present** = real tables/UI with that concern; **Stub** = name/table/env only; **Absent** = not in repo; **Mock** = UI with fake data.

| Target domain | Real state | Evidence |
| --- | --- | --- |
| Auth | Stub | `users.password_hash` in `lib/db.ts`; env `AUTH_SECRET` unused; no login UI |
| Users | Stub / hardcoded | `users` unused; people are route names `/rui` `/ana` |
| Households | Absent | Joint account is `owner='conjunta'` / `'familia'`, not a household entity |
| Accounts | Present (thin) | `accounts` table; 3 seed rows; little UI beyond CSV bank name |
| Transactions | Present | Core CRUD + CSV + dashboard |
| Categories | Present | Seed categories with `owner` and `budget_pct`; person pages re-hardcode percents |
| Budgets | Partial | Settings JSON in `api_keys.__budgets__`; UI constants `INCOME` / `pct` |
| Goals | Present | `goals` CRUD; `familia` special case |
| Assets | Partial | Folded into `investments` + account `balance` |
| Liabilities | Absent as model | Mortgage/insurance appear as expense transactions / hardcoded HAB list |
| Net Worth | Absent | Dashboard “Saldo” is month income − expenses, not assets − liabilities |
| Investments | Present (manual) | Table + UI; no live prices |
| Trading Integration | Mock / absent | `TradePage` mock charts; no Trading OS contract |
| Crypto | Partial | Bybit seed row; mock crypto chart on Trade page |
| Cash Flow | Implicit | Sums of `transactions.amount` by month |
| Forecasting | Absent | — |
| Financial Health | Absent | — |
| Simulator | Absent | — |
| CSV Import | Present | `/api/import` custom parser |
| Providers | Stub UI | Settings forms + env; `investments/sync` is a key-presence check |
| Open Banking | Incomplete | Enable Banking init/callback; unused GoCardless/Enable libs |
| Alerts | Absent | — |
| AI Context Engine | Inline prompt | Built inside `/api/ai-advisor` |
| AI Gateway | Absent | Direct Anthropic SDK call |
| Reporting | Minimal | LUMEU CSV export in the browser; `/api/backup` dumps the DB file |
| Settings | Present | API keys, budgets, backup, bank connect |

## Source-of-truth pipeline (target vs real)

**Target:** Providers → Finance OS → Financial Engine → Analytics → AI Context → AI Gateway → LLM

**Real:**

```
Human (form/CSV/seed)
   ↘
 SQLite (transactions, investments, goals, lumeu_expenses)
   ↘
 Page math (reduce/filter)  +  AI route SELECT *  → Anthropic
```

No financial engine, no analytics layer, no context compiler, no gateway. Broker/bank APIs are not actually pulling balances except the incomplete Enable Banking callback path.

## Ownership model (real vs target)

**Real:** string `owner` on accounts, categories, transactions, investments, goals.

Observed values:

- `'rui'`, `'ana'`, `'conjunta'`, `'familia'`, `'all'`
- `local.db` goal owner `'Rui'` (capital R) — inconsistent with lowercase used by the app
- Bank sync forces `'rui'`

**Target:** Users and Households with membership/roles; accounts belong to household or user; **not** `owner="rui"|"ana"|"familia"`.

## Provider adapters (real vs target)

**Target:** provider-agnostic adapters (bank, broker, crypto, CSV).

**Real:** no `adapters/` directory. Open Banking IDs are hardcoded maps:

```ts
// app/lib/gocardless.ts
'ActivoBank Rui': 'ACTIVOBANK_IE',   // placeholder
'Abanca Conjunta': 'ABANCA_ES',

// app/lib/enablebanking.ts
'ActivoBank Rui': 'activobank_activobankpt',
'Abanca Conjunta': 'abanca_abancapt',
```

Comments in-source say to replace placeholders. Institution country codes look wrong (ActivoBank Portugal mapped to `_IE`; Abanca Portugal mapped to `_ES` in GoCardless).

## Trading OS boundary (real vs target)

**Target:** Trading OS stays separate; Finance OS receives **aggregates only**.

**Real:** no boundary, no payload schema, no ingest endpoint. Trade “business” is a decorative dashboard.

## AI boundary (real vs target)

| Rule | Real |
| --- | --- |
| LLM never executes financial ops | Accidentally true (no tools) |
| LLM never has direct DB access | **False** — the API route runs SQL then puts rows in the system prompt |
| Gateway + redaction | **False** |
| Auth before AI | **False** |

## Critical architectural problems (not a rewrite list)

1. **Monolith route-handler SQL** — every feature is a page + a `route.ts`. Cannot test domain rules without HTTP + SQLite.
2. **Person as routing key** — adding a third household member means copying `/rui`.
3. **Three schemas in one repo** — `lib/db.ts`, `test-init.js`/`local.db`, plus runtime `bank_accounts` / unused `personal_transactions`.
4. **Two Open Banking designs** that do not share types or tables.
5. **Secrets and PII in git** — see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).
6. **Businesses mixed into household app** without tenancy (LUMEU expenses globally readable).
7. **Next 14.2.3 + unauthenticated write APIs** — a single exposed port is a full data-loss / data-exfil surface.
8. **Hardcoded economics in UI** (salaries, joint 650€, budget percents) diverge from Settings budgets and from live transactions.

## What to preserve

- Household UX: Dashboard, Rui, Ana, Conjunta, Investimentos, AI Advisor, Settings, LUMEU tracker.
- CSV import heuristics (Portuguese banks).
- Category vocabulary already in seed.
- Dark “Finance OS” visual language in `app/globals.css`.

Later phases should **wrap** these screens around services rather than replace them in one shot.
