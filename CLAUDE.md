# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on port **3002**
- `npm run check` — what CI runs: lint (`--max-warnings=0`) → typecheck → test → build. CI installs with `npm ci --legacy-peer-deps` and then asserts `data/finance.db` was NOT created by the build.
- `npm test` (vitest) · single file: `npx vitest run tests/ledger.test.ts` · single test: `npx vitest run -t "name"`
- `npm run db:migrate` / `db:rollback` — apply / revert SQL migrations; `db:init`, `db:seed`, `db:backup`, `db:purge-secrets` also exist
- `npm run user -- add "<Name>" <email>` — create users (no passwords in env vars)
- Config: copy `.env.example` → `.env.local`. `AUTH_SECRET` (`openssl rand -hex 32`) is required; `DATABASE_URL` defaults to `file:./data/finance.db`.

## Architecture

Finance OS: a local-first Next.js 14 (App Router) household finance app on SQLite via `@libsql/client`. UI and messages are in Portuguese (pt-PT). `@/` aliases the repo root.

The project is mid-migration from a prototype (hardcoded `owner='rui'|'ana'|'conjunta'` strings, no auth) to a household/ledger model. **`docs/` is the source of truth for process and direction** — read `docs/PROJECT_STATE.md` (real vs. target; parts predate the auth work and may be stale), `docs/ARCHITECTURE.md` (target), `docs/BACKLOG.md` (task IDs like A4b, B1a), `docs/DECISIONS.md`, and `docs/AGENT_PROTOCOL.md`. Per the protocol: work only within an approved backlog task, don't refactor beyond scope, stop and record a PENDING decision when a new architectural choice appears, and never print/commit secrets (`.env`, PEMs, `*.db`, `api_keys` rows). Legacy routes/pages (`/rui`, `/ana`, `/finance`, `/investments`, etc.) are still present alongside the new code.

Key pieces that span files:

- **DB access** (`lib/db.ts`): `db` / `getDb()` connect lazily so importing the module (e.g. during `next build`) never opens or creates a database. Tests set `process.env.DATABASE_URL` to a temp file and call `closeDb()`.
- **Migrations** (`lib/migrate.ts`, `migrations/NNNN_name.{up,down}.sql`): plain SQL, contiguous from 0001, each version in one transaction with its `schema_migrations` row, checksums detect edits to applied migrations, a backup is taken before changing an existing DB. A version without a `.down.sql` is irreversible (baseline). Never edit an applied migration; add a new one.
- **Auth** (`lib/auth/*`, `middleware.ts`): session cookie `fos_session`. `middleware.ts` only redirects to `/login` and is *not* a security boundary. Every API handler must be wrapped in `withAuth` (`lib/auth/guard.ts`, includes same-origin CSRF check) and pages call `requireUser()`. Authorization derives from the session only, never from owner/user ids sent by the client.
- **Households & ledger** (`lib/household.ts`, `lib/ledger.ts`, tables `ledger_*`): data is household-scoped; accounts are personal (`owner_user_id`) or joint (NULL owner). `ensureHouseholdDefaults` / `ensureMemberDefaults` are idempotent seeders.
- **Money** (`lib/money.ts`): always integer cents + ISO currency; floats only at the display edge. Use `parseAmountToCents` for input.
- **Import pipeline** (`lib/import/*`): each bank format implements `ImportSource` (`parse(bytes) → rows/errors/warnings`) and is registered in `lib/import/registry.ts`; `pipeline.ts` does preview, dedupe, and error reports. Fixtures in `tests/fixtures/<bank>/` (CP-1252 handling is done manually, not via Node's TextDecoder). Formats are documented in `docs/IMPORT_FORMATS.md`.
- **Tests** (`tests/*.test.ts`): vitest, node environment, synthetic data only — never real household data.
