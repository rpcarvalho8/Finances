# ROADMAP

Phased path **after** a human approves Phase 0. Durations are omitted (agent work is scoped by subsystems, not calendar).

## Phase 0 — Audit + plan (this PR)

- Inspect real git/state.
- Docs only under `/docs`.
- No architecture changes in source.
- Output: this pack + PENDING decisions.

**Exit:** Coordinator accepts findings and ticks decisions in [DECISIONS.md](./DECISIONS.md).

## Phase 0b — Emergency security (still not “features”)

Only after SEC-D01 / SEC-D02 / OPS-D01:

- Rotate Enable Banking key; remove PEM from tree; gitignore `*.pem` / `*.db`.
- Stop using loca.lt as a compiled-in redirect.
- Do not implement Auth yet unless AUTH-D01 is approved in the same batch.
- Optional: bind `next dev` to localhost explicitly; document “do not tunnel until Auth”.

**Exit:** Committed secrets gone from HEAD; rotation done out-of-band; history purge decided.

## Phase 1 — Freeze the household app (preserve)

Subsystems: SQLite bootstrap, Route Handlers as-is, UI as-is.

- Canonical schema = `initDB()` (DB-D01).
- Fix `db:init` (DB-002) so clones can create `data/finance.db` without running destructive seed.
- Lazy DB client so `next build` works (BUILD-001).
- Add `typecheck` script; keep `strict: false` until a later cleanup.
- Do **not** rename `/rui` yet (UX-D01).

**Exit:** Clean clone → init DB → `npm run dev` → dashboard renders (empty or seeded by choice).

## Phase 2 — Auth + authorization

Subsystems: Auth, Users (minimal), middleware, API 401s.

- Implement AUTH-D01.
- Protect backup, API keys, AI, bank sync, mutating routes.
- IDOR checks can be “same household” first if AUTH-D02 is “everyone in the household sees all”.

**Exit:** Unauthenticated access cannot download the DB or chat with AI.

## Phase 3 — Data model toward households (refactor)

Subsystems: Users, Households, Accounts, Transactions (FKs).

- Map string owners to ids **behind** existing pages (preserve labels “Rui”, “Ana”, “Conjunta”).
- Unify `accounts` vs `bank_accounts`.
- Drop or migrate dead tables (`personal_transactions`, unused bank_*).
- Deduplicate `/investments` vs `/investimentos`, `/lumeu` vs `/business/lumeu` (LEG-001).

**Exit:** No new code writes `owner='rui'` literals except a compatibility view.

## Phase 4 — Providers (one path each)

Subsystems: CSV Import (already real), Open Banking (OB-D01), one broker (PROV-D01).

- Provider adapter interface.
- Encrypted secret storage replacing plaintext `api_keys`.
- Idempotent AIS/CSV import (`import_id` UNIQUE).
- Fix amount-sign mismatch between bank callback and dashboard filters.

**Exit:** At least one live balance source **or** a documented “manual-only” policy.

## Phase 5 — Financial engine + AI isolation

Subsystems: Net Worth, Cash Flow, Budgets as data (not page constants), AI Context Engine, AI Gateway.

- Derived net worth (needs liabilities model — even a single mortgage row).
- AI route consumes engine snapshots only (AI-D01).
- Advisor UI unchanged.

**Exit:** Grep shows no SQL in the Anthropic-calling module.

## Phase 6 — Trading OS + remaining domains

Subsystems: Trading Integration, Crypto (as providers), Alerts, Reporting, Forecasting, Simulator.

- Aggregate ingest (TRD-D01).
- Trade page labeled with as-of timestamps, not mock Recharts.
- Alerts for failed sync / budget overrun.

**Exit:** Finance OS still does not place trades; Trading OS remains separate.

## Phase 7 — Hardening

- Next.js patched (SEC-D04).
- TypeScript `strict` incrementally.
- Tests for repositories and authz.
- CI on GitHub Actions (does not exist today).

## Explicitly out of order

Do **not** jump to Simulator, multi-tenant SaaS, or extra venues (Revolut/OKX/Exodus/Kraken) before Auth and a canonical DB. Those domains are absent on purpose.
