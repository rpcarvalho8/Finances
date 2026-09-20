# ARCHITECTURE.md

Target architecture for Finance OS and a **migration path from the real codebase**. This is a plan, not a claim that these modules exist. Real state: [PROJECT_STATE.md](./PROJECT_STATE.md), [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md).

## Design principles

1. **Preserve then refactor then improve.** Keep the household UI (Dashboard, Rui/Ana/Conjunta, Investimentos, LUMEU, Settings, AI Advisor) working while inserting layers behind it.
2. **Do not invent runtime that is not approved.** New domains land as empty modules only after Phase 0 decisions.
3. **Finance OS is the system of record for household money.** Brokers and banks are providers. Trading OS is a **peer**, not a submodule.
4. **AI is a reader, not an operator.**

## Target domains

| Domain | Responsibility |
| --- | --- |
| Auth | Login, sessions, password hashing, CSRF |
| Users | People with ids, not route slugs |
| Households | Family/economic unit; membership + roles |
| Accounts | Bank/cash/credit containers owned by user or household |
| Transactions | Movements, imports, idempotency (`import_id`) |
| Categories | Taxonomy + household overrides |
| Budgets | Period budgets referencing categories; no hardcoded 50/13/12 splits in pages |
| Goals | Targets with contributions; household vs personal scope |
| Assets | Valued items (investments, savings pots, property) |
| Liabilities | Loans, credit — first-class, not just expense lines |
| Net Worth | Derived: assets − liabilities at a date |
| Investments | Positions; prices via provider adapters |
| Trading Integration | Ingest **aggregates** from Trading OS only |
| Crypto | Crypto venues as providers under Assets/Investments |
| Cash Flow | Period in/out, runway |
| Forecasting | Projections on top of cash flow + goals |
| Financial Health | Scores/rules (savings rate, emergency fund months) |
| Simulator | What-if; no writes to ledger |
| CSV Import | Bank-specific parsers behind one interface |
| Providers | Adapter registry (banks, brokers, crypto, CSV) |
| Open Banking | PSD2 consents, AIS sync, token vault |
| Alerts | Thresholds, failed syncs |
| AI Context Engine | Builds a compact, policy-compliant snapshot |
| AI Gateway | Auth, redaction, model call, audit; **no tools that mutate** |
| Reporting | Exports, period reports |
| Settings | Preferences, connected providers (never echo secrets) |

## Target layers

```
UI (App Router pages — keep current screens initially)
  → API Route Handlers / Server Actions (thin)
      → Application Services (use-cases: ImportCsv, ListMonth, ConnectBank)
          → Domain (Household, Account, Transaction, Consent, Position)
              → Repositories (interfaces)
                  → Database (SQLite/libsql now; same schema via migrations)
```

Providers sit **beside** application services:

```
Provider adapters → normalize → Application Services → Repositories
```

### Source of truth (target)

```
Providers (Open Banking, CSV, Brokers, Trading OS aggregates)
    → Finance OS (ledger + positions + consents)
        → Financial Engine (balances, cash flow, net worth)
            → Analytics / Reporting
                → AI Context Engine
                    → AI Gateway
                        → LLM (text only)
```

## Mapping from real modules

| Keep (wrap) | Split later | Delete / quarantine after approval |
| --- | --- | --- |
| `app/rui|ana|conjunta/page.tsx` as **skins** over a member id | Person routes → `/household` + `/members/:id` | `/investments` duplicate of `/investimentos` |
| `components/UI.tsx` forms | Extract `AddTransactionForm` to Transactions UI | `app/finance/page.tsx` + unused `actions.ts` until redesigned |
| `app/api/transactions/*` | Move SQL to repository | Hardcoded `owner='rui'` in bank callback |
| `app/api/import/route.ts` categorizer | CSV adapter per bank | — |
| `lib/db.ts` table ideas | Formal migrations; drop unused `users` until Auth | Committed `local.db` / `test-init.js` as app DB |
| LUMEU expense tracker | Businesses as household projects | Duplicate `app/lumeu/page.tsx` vs component |
| Settings API-key **UX** | Secret vault | Plaintext `api_keys` |
| AI Advisor **UX** | Context Engine + Gateway | Inline `SELECT *` in the route |
| Enable Banking init/callback **intent** | One Open Banking adapter | Dual unused GoCardless + enablebanking libs **or** merge after choosing a vendor |
| `TradePage` | Replace mock with Trading OS aggregate widgets | Mock numbers presented as live |

## Users / households (target data)

Replace string owners:

```
Household
  id, name
Membership
  household_id, user_id, role (adult | member | viewer)
Account
  id, household_id, holder_user_id null, institution, kind, currency
Transaction
  id, account_id, booked_at, amount_minor, currency, category_id, source (manual|csv|ais|…)
```

UI can still show “Rui” / “Ana” / “Conjunta” as **labels** of members and a joint account. Routes should not be the identity model.

Migration of existing rows (later phase): map `'rui'|'ana'` → user ids, `'conjunta'|'familia'` → household joint account / household-scoped goals, `'all'` → household categories.

## Provider adapters (target)

```
interface ProviderAdapter {
  id: string
  kind: 'bank' | 'broker' | 'crypto' | 'csv' | 'trading-os'
  capabilities: ('balances' | 'transactions' | 'positions')[]
}
```

Concrete adapters (only when approved): ActivoBank/ABANCA via **one** Open Banking vendor; XTB; IBKR; Bybit; Binance; Trading212; CSV Activobank; CSV Abanca.

**Not in repo today:** Revolut, OKX, Exodus, Kraken — do not generate fake adapters. Add when there is a real credential + use case (Decision PROV-D01).

## Trading OS (target)

- Separate repository / process.
- Finance OS exposes e.g. `POST /api/integrations/trading-os/aggregates` (auth: signed service token) accepting **summaries**: equity, open PnL, realized PnL by book, as-of timestamp — **not** full trade blotters unless a later decision says otherwise.
- `TradePage` becomes a viewer of last aggregate snapshot.
- Finance OS never places orders.

## AI (target)

See [SECURITY.md](./SECURITY.md). Context Engine inputs: period cash flow, budget variance, net worth, goal gap, investment allocation — produced by the Financial Engine, not by pasting descriptions of every card payment.

## Database (target)

- Single schema, versioned migrations (tool TBD — Decision DB-D02).
- `initDB()` CREATE IF NOT EXISTS is acceptable only as bootstrap for empty files; it is not a migration system.
- SQLite/libsql remains appropriate for a household OS on Ubuntu; do not introduce Postgres in Phase 1 unless a decision says so.

## Incremental migration path

Do **not** start with a greenfield rewrite.

| Step | After approval of | Action |
| --- | --- | --- |
| 0 | This pack | Docs only (done in this PR) |
| 0b | SEC-D01 | Secret rotation + gitignore (still small, high urgency) |
| 1 | AUTH-D01, DB-D01 | Auth + freeze canonical schema; stop person-string writes in new code |
| 2 | — | Repositories behind existing Route Handlers (behavior-preserving) |
| 3 | OB-D01 | Single Open Banking adapter; retire the other sketch |
| 4 | AI-D01 | Gateway + context compiler; keep Advisor UI |
| 5 | PROV-D01 | First live broker adapter (likely the one with real keys) |
| 6 | TRD-D01 | Trading OS aggregate ingest |
| 7 | — | Net worth, liabilities, forecasts, alerts, simulator as new domains |

Each step ships behind the existing UI. Person-named routes can remain as aliases until step 1 screens are renamed.

## Non-goals (near term)

- Multi-tenant SaaS
- Mobile apps
- LLM-initiated payments
- Embedding Trading OS inside this repo
