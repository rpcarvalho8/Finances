# PROJECT_CONFIG

Facts discovered from the working tree and git metadata. Nothing here is invented.

## Repository

| Field | Value |
| --- | --- |
| GitHub URL | https://github.com/rpcarvalho8/Finances |
| Package name | `finance-os` (`package.json` `"name": "finance-os"`, `"version": "1.0.0"`, `"private": true`) |
| UI product name | Finance OS (`app/layout.tsx` metadata title; sidebar brand) |
| Default / current branch at audit | `main` (tracking `origin/main`) |
| Remote `origin` fetch | `https://github.com/rpcarvalho8/Finances` |
| Remote branches | `origin/main` only (confirmed via `git branch -a` and GitHub `list_branches`) |
| HEAD commit SHA | `170427abfc290bf0647abc0e0d8b9b3e1dc9a563` |
| HEAD message | `Initial commit` |
| HEAD author | Split Company `<splitcompany2022@gmail.com>` |
| HEAD date | 2026-06-09 15:45:42 +0100 |
| History | Single commit on `main`. No tags. |
| Working tree at audit start | Clean, up to date with `origin/main` |

Phase 0 documentation branch (this pack): `cursor/docs-phase-0-audit-ec45`.

## Layout (tracked source)

```
app/                 Next.js App Router pages + API route handlers
  api/               REST-ish handlers (transactions, investments, AI, bank sync, …)
  lib/               Enable Banking + GoCardless helpers + unused db-server
  finance/           Unused/broken finance page + unused server actions
  rui|ana|conjunta   Person/account-named routes
  investimentos/     Portuguese investments UI (sidebar target)
  investments/       English duplicate of investments UI
  lumeu/             Duplicate of LUMEU business page
  business/[slug]/   Business switcher (lumeu, trade, condoflow)
components/          Sidebar, shared UI, business pages
lib/db.ts            Canonical libsql client + CREATE TABLE IF NOT EXISTS
scripts/             seed.ts, setup-ubuntu.sh (no init-db.ts)
test-init.js         Alternate schema writer targeting file:local.db
.env.example         Env template (Portuguese comments; Enable Banking placeholders)
.claude/             Local Claude Code permissions
```

`local.db` and the Enable Banking `.pem` were removed from HEAD on 2026-09-20 (still in git history at `170427a`).

There is **no** root `README.md`, **no** `/docs` before this pack, **no** `Dockerfile`, **no** `.github/` workflows or PR template, **no** `middleware.ts`.

## Tech stack (from `package.json` and configs)

| Layer | Real dependency / config |
| --- | --- |
| Runtime | Node (setup script installs Node 20 via nvm if missing) |
| Framework | Next.js **14.2.3** (App Router) |
| UI | React 18, Tailwind 3.4, most screens use inline styles + CSS variables in `app/globals.css` |
| Charts | `recharts` ^2.15.4 (used by mock Trade dashboard only) |
| DB client | `@libsql/client` ^0.6.0 |
| Intended DB | SQLite via `DATABASE_URL=file:./data/finance.db` (`.env.example`) |
| CSV | `papaparse` is in dependencies; **import path uses a custom `;` splitter**, not papaparse |
| Validation | `zod` is in dependencies; **no application imports found** |
| AI | `@anthropic-ai/sdk` ^0.39.0, model `claude-sonnet-4-20250514` in `app/api/ai-advisor/route.ts` |
| Dates | `date-fns` in dependencies; **no application imports found** |
| Language | TypeScript 5, `tsconfig.json` `"strict": false` |
| Dev runners | `tsx`, `ts-node` |

### npm scripts that exist

```
dev       next dev -p 3002
build     next build
start     next start
db:init   tsx scripts/init-db.ts     ← file DOES NOT EXIST
db:seed   tsx scripts/seed.ts
```

**Missing scripts:** `lint`, `test`, `typecheck`, `format`. No Jest/Vitest/Playwright/ESLint config files.

### Next config note

`next.config.js` sets `serverExternalPackages: ['@libsql/client']`. That key is a Next 15 name. This repo pins Next **14.2.3**, which historically used `experimental.serverComponentsExternalPackages`. Treat as a compatibility risk, not as proof the app is on Next 15.

## Environment variables (names only)

From `.env.example` (placeholders, not live secrets):

- `ANTHROPIC_API_KEY`
- `AUTH_SECRET`
- `RUI_PASSWORD`, `ANA_PASSWORD`
- `DATABASE_URL` (default `file:./data/finance.db`)
- `NEXT_PUBLIC_APP_NAME`, `NODE_ENV`, `PORT`
- `XTB_ACCOUNT_ID`, `XTB_PASSWORD`
- `IBKR_HOST`, `IBKR_PORT`, `IBKR_CLIENT_ID`
- `BYBIT_API_KEY`, `BYBIT_SECRET`
- `BINANCE_API_KEY`, `BINANCE_SECRET`
- `TRADING212_API_KEY`
- `ENABLE_BANKING_APPLICATION_KEY`
- `ENABLE_BANKING_APPLICATION_SECRET` (or `ENABLE_BANKING_PRIVATE_KEY_PATH`)
- `ENABLE_BANKING_REDIRECT_URI`
- `ENABLE_BANKING_ASPSP_COUNTRY`, `ENABLE_BANKING_ASPSP_NAME`

Used in code but **not** listed in `.env.example`:

- `NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY` / `NEXT_PUBLIC_ENABLE_BANKING_REDIRECT_URI` (callback still reads the `NEXT_PUBLIC_` application key)
- `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`

Hardcoded fallbacks in `app/api/sync/bank/init/route.ts` were **removed 2026-09-20** (SEC-D01 option 1). Init now requires `ENABLE_BANKING_APPLICATION_KEY` and `ENABLE_BANKING_REDIRECT_URI` (fail closed). Previously:

- Client id matching the committed `.pem` filename
- Redirect `https://small-bats-appear.loca.lt/api/sync/bank/callback`

`scripts/setup-ubuntu.sh` writes a `.env.local` with weak demo values `AUTH_SECRET=dev-secret-finance-os-2026`, `RUI_PASSWORD=rui123`, `ANA_PASSWORD=ana123` if the file is missing.

## Database URL vs committed DB file

| Path | Git | `.gitignore` | Role |
| --- | --- | --- | --- |
| `file:./data/finance.db` | Not present (data/ empty / missing) | `data/*.db` ignored | Intended app DB |
| `local.db` (repo root) | **Removed from HEAD 2026-09-20**; still in history at `170427a` | `*.db` / `local.db` ignored | Written by `test-init.js`; **different schema** from `lib/db.ts` |
| `e05443a5-b2a3-454d-9f7a-703fb7e9a0ad.pem` | **Removed from HEAD 2026-09-20**; still in history at `170427a` | `*.pem` ignored | Enable Banking JWT signing key (burned; rotate in console) |

## Audit toolchain snapshot

Recorded during Phase 0 on this environment (Node v22.14.0):

| Command | Result |
| --- | --- |
| `npm install --legacy-peer-deps` | Success, 222 packages. Warns Next 14.2.3 security advisory; Recharts 2.x deprecated. |
| `npm audit` | 9 vulnerabilities: 1 critical, 5 high, 1 moderate, 2 low. Critical sample: `next` (cache poisoning GHSA). High samples: `browserslist`, `form-data`, `nanoid`, `postcss`, `ws`. |
| `npx tsc --noEmit` | **Exit 0** (`strict: false`). |
| `npm run db:init` | **Exit 1** — `ERR_MODULE_NOT_FOUND` for `/workspace/scripts/init-db.ts`. |
| `npm run build` | **Exit 1** after compile. Warns `Unrecognized key(s) in object: 'serverExternalPackages'`. Then “Failed to collect page data for /api/goals”: `Failed to connect to database: ./data/finance.db` (`@libsql/client` opens the file at module import). |
| `npm run lint` / `npm test` / `npm run typecheck` | Scripts **do not exist**. |

`.next/` from the failed build is gitignored and must not be committed.
