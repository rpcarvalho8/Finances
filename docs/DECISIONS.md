# DECISIONS

Open decisions that **block** implementation after Phase 0. All items are **PENDING** until a human records an outcome here (or in a follow-up commit).

Format: ID, question, context, options, recommendation (non-binding), status.

---

## SEC-D01 — Secret remediation for committed PEM (and history)

- **Question:** How should the Enable Banking private key file `e05443a5-…pem` be removed, and should git history be rewritten?
- **Context:** Key is in the initial commit on `main`. `.gitignore` does not ignore `*.pem`. Application id is hardcoded to the same UUID. See SECURITY_AUDIT SEC-A01.
- **Options:**
  1. Rotate key at Enable Banking, delete file in a forward commit, keep history (key remains recoverable from SHA `170427a`).
  2. Rotate key, then `git filter-repo` / BFG, force-push `main` (destructive; all clones must re-clone).
  3. Leave file, privatize repo only (insufficient if the repo was ever cloned).
- **Recommendation:** (2) if any clone may have been public or shared; otherwise (1)+immediate rotation still required. **Never** commit a replacement PEM.
- **Status:** **PENDING**
- **Blocks:** SEC-001, SEC-004

---

## SEC-D02 — Committed `local.db`

- **Question:** Delete `local.db` from the tree, gitignore it, and/or purge history?
- **Context:** Different schema from `lib/db.ts`; small sample rows. See DATABASE_AUDIT.
- **Options:** Delete forward-only vs history purge vs keep as fixture (not recommended).
- **Recommendation:** Delete + gitignore `*.db`; do not use as a test fixture without synthetic data.
- **Status:** **PENDING**
- **Blocks:** SEC-002, DB-001

---

## SEC-D03 — Household PII in `scripts/seed.ts`

- **Question:** Keep real-looking household seed, replace with synthetic demo data, or move seed out of git?
- **Context:** Salaries, employers, merchants, family names. Required for the current UI demo.
- **Options:** Anonymize in-repo / private data pack / leave as-is because repo is private.
- **Recommendation:** Synthetic seed in git; real import via CSV locally (not committed).
- **Status:** **PENDING**
- **Blocks:** SEC-005 (not to run without approval — rewrites data the UI relies on)

---

## SEC-D04 — Next.js security upgrade

- **Question:** Upgrade Next 14.2.3 despite possible App Router / config breakage (`serverExternalPackages` already invalid on 14.2.3)?
- **Context:** `npm audit` critical/high on `next`; vendor advisory to a patched release.
- **Options:** Patch-level 14.2.x vs jump to last 14.2 patch vs Next 15 (would make `serverExternalPackages` valid).
- **Recommendation:** Move to the latest patched 14.2.x first (smallest). Next 15 is a separate decision.
- **Status:** **PENDING**
- **Blocks:** SEC-006

---

## AUTH-D01 — Authentication model

- **Question:** Session-based login for household members vs single shared password vs bind to OS user only (localhost assumption)?
- **Context:** Env sketches two passwords (`RUI_PASSWORD`, `ANA_PASSWORD`) but no code. Target wants Users + Households.
- **Options:**
  1. Localhost-only (firewall) — still no Auth in app.
  2. One household PIN.
  3. Per-user passwords using `users` table.
- **Recommendation:** (3) aligned with target; (1) is unacceptable if Open Banking tunnels remain.
- **Status:** **PENDING**
- **Blocks:** AUTH-001 and all public-network deploys

---

## AUTH-D02 — Authorization granularity

- **Question:** Can Ana see Rui’s personal account? Can either see LUMEU?
- **Context:** Today everyone sees everything. Goals API already mixes `familia` into personal queries.
- **Status:** **PENDING**
- **Blocks:** AUTH-002

---

## DB-D01 — Canonical schema

- **Question:** Is `lib/db.ts` `initDB()` the source of truth (INTEGER PKs, `saved`, `owner` strings) until a migrated household schema exists?
- **Context:** `local.db` / `test-init.js` disagree; `personal_transactions` / `bank_*` tables are undeclared.
- **Recommendation:** Yes — freeze `initDB()` as canonical; treat other schemas as dead. Then plan Users/Households migration (not Phase 0).
- **Status:** **PENDING**
- **Blocks:** DB-001, DB-002

---

## DB-D02 — Migration tool

- **Question:** Stay on ad-hoc `CREATE IF NOT EXISTS` or adopt a migrator (Drizzle, Prisma, raw SQL in `migrations/`)?
- **Recommendation:** `migrations/*.sql` applied by a small `scripts/migrate.ts` — fewer new ORMs. Decision can wait until first schema change after freeze.
- **Status:** **PENDING**

---

## DB-D03 — Database engine

- **Question:** Keep SQLite/libsql file vs Turso vs Postgres.
- **Context:** Product is a local Ubuntu household OS (`setup-ubuntu.sh`).
- **Recommendation:** Stay on file SQLite until there is a second machine / remote backup requirement.
- **Status:** **PENDING**

---

## OB-D01 — Open Banking vendor

- **Question:** Enable Banking (partially wired, committed key) vs GoCardless/Nordigen (unused lib) vs neither (CSV only)?
- **Context:** Two incomplete stacks; placeholder ASPSP ids; loca.lt redirect.
- **Recommendation:** Pick **one**. Do not keep both libs. If Enable Banking key is burned, budget a new application registration.
- **Status:** **PENDING**
- **Blocks:** OB-001

---

## OB-D02 — Bank identity mapping

- **Question:** How do AIS accounts map to Finance OS accounts (Rui Activobank, Ana Abanca, joint Abanca)?
- **Context:** Callback forces `owner='rui'` and `account_id=1`.
- **Status:** **PENDING**

---

## PROV-D01 — Which investment venues to automate first

- **Question:** Of XTB, IBKR, Bybit, Binance, Trading212, PPR, PoupeUp — which get real adapters vs stay manual?
- **Context:** Settings UI lists XTB/IBKR/Bybit/Binance/T212. Seed has XTB, IBKR, Bybit, PPR, PoupeUp. **Revolut, OKX, Exodus, Kraken have zero code.**
- **Recommendation:** Manual remain default. First adapter = whichever venue the household actually uses weekly (likely Bybit or XTB given seed). Do **not** build unused venues.
- **Status:** **PENDING**

---

## AI-D01 — Anthropic data sharing

- **Question:** Is sending merchant-level transactions to Anthropic acceptable for this household?
- **Context:** Current Advisor does exactly that, unauthenticated. Target forbids raw DB → LLM.
- **Options:** Disable AI until Gateway exists / allow aggregates only / allow raw descriptions with explicit consent.
- **Recommendation:** Disable public exposure immediately (auth); then aggregates-only default.
- **Status:** **PENDING**
- **Blocks:** AI-001

---

## AI-D02 — Model product

- **Question:** Keep `@anthropic-ai/sdk` + `claude-sonnet-4-20250514` vs a model gateway that can switch providers.
- **Recommendation:** Keep Anthropic; add Gateway interface internally so the model is swappable later.
- **Status:** **PENDING**

---

## TRD-D01 — Trading OS relationship

- **Question:** Does a Trading OS already exist in another repo, and what aggregate payload should Finance OS accept?
- **Context:** This repo has only mock Trade UI. No shared schema.
- **Recommendation:** Do not embed a trading engine here. Define a one-page JSON contract when Trading OS is ready.
- **Status:** **PENDING**
- **Blocks:** TRD-001

---

## UX-D01 — Person-named routes

- **Question:** Keep `/rui` `/ana` as permanent UX or treat as aliases after Users exist?
- **Recommendation:** Aliases. Matches preserve-then-refactor.
- **Status:** **PENDING**

---

## UX-D02 — Duplicate screens

- **Question:** Delete `/investments`, `/lumeu`, `/finance` after confirming unused?
- **Recommendation:** Yes after AUTH freeze; sidebar already uses `/investimentos` and `/business/lumeu`.
- **Status:** **PENDING**
- **Blocks:** LEG-001 (non-destructive until approved)

---

## REL-D01 — `test-init.js` and missing `scripts/init-db.ts`

- **Question:** Replace `db:init` with a call to `initDB()` and retire `test-init.js`?
- **Recommendation:** Yes. Smallest correctness fix after DB-D01.
- **Status:** **PENDING**
- **Blocks:** DB-003

---

## OPS-D01 — Exposure model

- **Question:** Is this app allowed to bind beyond localhost? Current setup mentions Ubuntu desktop + `local.lt` for PSD2.
- **Recommendation:** Localhost only until Auth + secret rotation. PSD2 redirect via a controlled HTTPS domain, not a random tunnel name in source.
- **Status:** **PENDING**
