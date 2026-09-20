# BACKLOG

Phase 0 backlog: **documentation/audit closure** and **security remediations that must not run until a human approves**. No feature implementation in this phase.

Status keys: `done` | `open` | `blocked` (needs decision in [DECISIONS.md](./DECISIONS.md)).

---

## AUDIT-001 — Repository audit

- **Objective:** Inspect the real git tree, stack, schema, auth, providers, AI, tests, and security artifacts; write evidence-based docs.
- **Context:** Single commit `170427abfc290bf0647abc0e0d8b9b3e1dc9a563` on `main`; product name Finance OS.
- **Dependencies:** None.
- **Acceptance criteria:**
  - All files listed in `docs/README.md` exist.
  - Claims cite paths (and short quotes/summaries).
  - Real vs target is explicit; no invented modules described as existing.
- **Risks:** Stale if `main` moves; re-run grep for `*.pem` / `*.db` on later phases.
- **Status:** `done` (this pack)

---

## DOC-001 — Documentation pack + index

- **Objective:** Add `/docs` index and planning files only.
- **Context:** Repo had no README/docs/CI.
- **Dependencies:** AUDIT-001.
- **Acceptance criteria:** `docs/README.md` links every pack file; PR is docs-only (no `app/` `lib/` `components/` `scripts/` edits).
- **Risks:** None to runtime.
- **Status:** `done` (this PR)

---

## DOC-002 — Record Phase 0 quality-bar results

- **Objective:** Capture `tsc`, `next build`, `db:init`, `npm audit` outcomes in PROJECT_CONFIG / PROJECT_STATE.
- **Context:** No `test`/`lint` scripts.
- **Dependencies:** AUDIT-001.
- **Acceptance criteria:** Exit codes and failure reasons documented (not “fixed”).
- **Risks:** Build may create `.next/` locally — must not be committed (already gitignored).
- **Status:** `done`

---

## SEC-001 — Remove committed Enable Banking private key from the working tree

- **Objective:** Stop shipping `e05443a5-b2a3-454d-9f7a-703fb7e9a0ad.pem` on the default branch.
- **Context:** SECURITY_AUDIT SEC-A01. Filename = previously hardcoded CLIENT_ID.
- **Dependencies:** **SEC-D01 (DECIDED 2026-09-20, option 1)**.
- **Acceptance criteria:** File absent from HEAD; `*.pem` gitignored; app reads key only from env or an out-of-repo path; **docs never contain PEM body**.
- **Risks:** **Destructive / availability.** History still contains the key at SHA `170427a`. Treat key as burned. Bank connect stays down until SEC-004 (human console rotation).
- **Status:** `done` (2026-09-20). PEM deleted from HEAD in a forward commit; init no longer scans cwd for `*.pem` or `${CLIENT_ID}.pem`. Console rotation remains SEC-004.

---

## SEC-002 — Remove committed `local.db`

- **Objective:** Stop tracking the SQLite file at repo root.
- **Context:** SECURITY_AUDIT SEC-A02; schema is not `initDB()`.
- **Dependencies:** **SEC-D02 (DECIDED 2026-09-20)**. DB-D01 (canonical schema) remains PENDING.
- **Acceptance criteria:** File not in HEAD; gitignore covers `*.db` / `local.db`; README/docs say to create `data/finance.db` via seed.
- **Risks:** If anyone pointed `DATABASE_URL` at `file:local.db`, app data that only existed there is lost (this clone’s `local.db` is the committed sample, not `finance.db`). History still contains the file at SHA `170427a`.
- **Status:** `done` (2026-09-20). Use `DATABASE_URL=file:./data/finance.db` and `npm run db:seed` (or a future `db:init`) to create the intended app DB.

---

## SEC-003 — Tighten `.gitignore` for secrets and databases

- **Objective:** Ignore `*.pem`, `*.db`, `local.db`, remaining env files, backups.
- **Context:** Previous ignore was `node_modules/`, `.next/`, `.env.local`, `.env`, `data/*.db`, `backups/`, `uploads/`, `*.log`.
- **Dependencies:** SEC-D01/D02 (DECIDED 2026-09-20).
- **Acceptance criteria:** New clones cannot accidentally add PEM/DB; existing tracked files still need `git rm --cached` (done in the same change).
- **Risks:** Low.
- **Status:** `done` (2026-09-20). `.gitignore` now includes `*.pem`, `*.db`, `local.db`; existing `data/*.db` / `data/*.db-journal` rules kept.

---

## SEC-004 — Rotate Open Banking application credentials

- **Objective:** Invalidate the committed keypair and hardcoded application UUID; issue new credentials stored only in env.
- **Context:** SEC-A01, SEC-A06. Code defaults (burned UUID / loca.lt redirect) were removed with SEC-001; the **console rotation is still human-owned**.
- **Dependencies:** SEC-D01 (DECIDED option 1), OB-D01, OPS-D01.
- **Acceptance criteria:** Old UUID no longer in source as a default; redirect URI from env with no tunnel hostname in git; provider console shows new key.
- **Risks:** Breaks bank connect until Settings is reconfigured. **Do not put the new secret in the repo.** History still has the old private key at commit `170427a`.
- **Status:** `blocked` on **human** Enable Banking console rotation (old UUID is burned). Code-side defaults are already gone.

---

## SEC-005 — Anonymize or extract household seed

- **Objective:** Remove real salaries/employers/merchants from git if SEC-D03 says so.
- **Context:** `scripts/seed.ts` is the demo dataset the UI expects.
- **Dependencies:** **SEC-D03**. Changing seed is an application/data change.
- **Acceptance criteria:** Git has only synthetic data **or** seed is documented as private-only and not on a public remote.
- **Risks:** Demo screens empty; users must re-import CSV.
- **Status:** `blocked`

---

## SEC-006 — Patch Next.js (and audit high/critical deps)

- **Objective:** Leave 14.2.3 for a vendor-patched release; re-run `npm audit`.
- **Context:** SEC-D04, `npm audit` 1 critical / 5 high.
- **Dependencies:** **SEC-D04**. Requires regression of `next build` (today build already fails without `data/finance.db`).
- **Acceptance criteria:** Advisory for `next` closed or accepted with written exception; build documented.
- **Risks:** Config key `serverExternalPackages` vs Next 14 experimental key.
- **Status:** `blocked`

---

## AUTH-001 — Introduce real authentication

- **Objective:** Gate all `/api/*` and Server Components on a session. Stop using unused env passwords as if they were a design.
- **Context:** `users` table exists; no login. Tunnels + backup + AI make this urgent **after** Phase 0 approval.
- **Dependencies:** **AUTH-D01**, preferably SEC-003.
- **Acceptance criteria:** Unauthenticated GET `/api/backup` and POST `/api/transactions` return 401; household members can log in; passwords not in setup script defaults.
- **Risks:** Locks out current zero-auth local workflow; need a bootstrap user.
- **Status:** `blocked`

---

## AUTH-002 — Authorization / IDOR

- **Objective:** Enforce household/member checks on GET/PUT/DELETE by id.
- **Dependencies:** AUTH-001, AUTH-D02, users/households model (not Phase 0).
- **Acceptance criteria:** Member A cannot delete member B’s personal transactions if policy forbids it.
- **Risks:** Breaking dashboard that currently shows everyone.
- **Status:** `blocked`

---

## DB-001 — Declare canonical schema and stop dual DBs

- **Objective:** Document+enforce one schema (`initDB`) as the only runtime DB; `local.db` not used.
- **Dependencies:** **DB-D01**, SEC-002.
- **Acceptance criteria:** PROJECT docs + (later) single `DATABASE_URL`; `test-init.js` either deleted or clearly marked dead.
- **Risks:** Confusion if `db:init` still points at missing file.
- **Status:** `blocked`

---

## DB-002 — Create missing `scripts/init-db.ts` **or** retarget `db:init`

- **Objective:** `npm run db:init` should run `initDB()` without seeding destructive DELETEs.
- **Context:** Script missing; seed both inits and loads PII.
- **Dependencies:** **REL-D01**, DB-D01.
- **Acceptance criteria:** Empty DB file created with canonical tables; no DELETE of user data.
- **Risks:** Low if it only CREATE IF NOT EXISTS.
- **Status:** `blocked` (code change)

---

## DB-003 — Quarantine undeclared tables

- **Objective:** Either add `personal_transactions` / `bank_requisitions` / `bank_balances` to migrations or delete dead code that references them.
- **Dependencies:** DB-D01, OB-D01, UX-D02.
- **Acceptance criteria:** No SQL against tables that `initDB` does not create.
- **Risks:** Removing `app/finance/actions.ts` is a product decision.
- **Status:** `blocked`

---

## OB-001 — Choose and complete one Open Banking path

- **Objective:** One vendor, one consent model, mapped accounts, no hardcoded owner.
- **Dependencies:** **OB-D01**, OB-D02, SEC-004, AUTH-001 (should not connect banks without auth).
- **Acceptance criteria:** Happy-path AIS sync into canonical `accounts`/`transactions` with idempotent `import_id`; unused lib removed or clearly stubbed.
- **Risks:** PSD2 liability, token storage (must not remain plaintext).
- **Status:** `blocked`

---

## AI-001 — AI Gateway + Context Engine (stop raw SQL → LLM)

- **Objective:** Advisor UI kept; model never sees full descriptions by default (pending AI-D01); route does not query arbitrary tables inline.
- **Dependencies:** **AI-D01**, AUTH-001.
- **Acceptance criteria:** Architecture tests or review: no `db.execute` in the file that calls `anthropic.messages.create`; audit log of context hash.
- **Risks:** Quality of advice may drop if only aggregates are sent.
- **Status:** `blocked`

---

## PROV-001 — Provider adapter spike (single venue)

- **Objective:** One real adapter (Decision PROV-D01) **or** officially document “manual only”.
- **Dependencies:** PROV-D01, AUTH-001, encrypted secrets (SEC-A04).
- **Acceptance criteria:** `/api/investments/sync` either calls the venue or is renamed so it does not imply live sync.
- **Risks:** Storing XTB password / exchange secrets.
- **Status:** `blocked`

---

## TRD-001 — Trading OS aggregate contract

- **Objective:** Spec only until TRD-D01; then ingest endpoint for aggregates.
- **Dependencies:** **TRD-D01**.
- **Acceptance criteria:** A documented JSON schema; mock Trade page clearly labeled until wired.
- **Risks:** Mixing prop-firm fantasy numbers with household net worth.
- **Status:** `blocked`

---

## LEG-001 — Remove or alias duplicate routes

- **Objective:** Single investments UI, single LUMEU page, retire `/finance` or implement `/api/finances`.
- **Dependencies:** **UX-D02**.
- **Acceptance criteria:** Sidebar targets are the only living pages; duplicates redirect or deleted.
- **Risks:** Bookmarks.
- **Status:** `blocked`

---

## QA-001 — Add lint / typecheck / test scripts

- **Objective:** `npm run typecheck` (tsc), lint, and at least a smoke test for `initDB` + one API authz once Auth exists.
- **Dependencies:** None for adding scripts; useful after DB file bootstrap so `next build` can collect page data.
- **Acceptance criteria:** CI (when it exists) runs them; `next build` does not require a pre-existing DB **or** docs explain the bootstrap order.
- **Risks:** `createClient` at import time currently **fails `next build`** if `./data/finance.db` is missing.
- **Status:** `open` (can be scheduled post-approval; touching `package.json` is not Phase 0)

---

## BUILD-001 — Lazy DB client so production build does not require a file

- **Objective:** Stop `createClient()` at module load so `next build` “collecting page data” does not open SQLite.
- **Context:** Phase 0 `npm run build` compiled then failed: `Failed to connect to database: ./data/finance.db` while collecting `/api/goals`.
- **Dependencies:** Human approval (application change).
- **Acceptance criteria:** `next build` succeeds on a clean clone without `data/finance.db`.
- **Risks:** Subtle connection lifecycle bugs.
- **Status:** `blocked`

---

## Phase 0 closure checklist

- [x] Audit evidence collected
- [x] Docs pack written under `/docs`
- [x] No feature/refactors in `app/`, `lib/`, `components/`, `scripts/` *(Phase 0 docs PR; later SEC-D01/D02 remediates init + gitignore only)*
- [x] Decisions listed as PENDING *(SEC-D01/D02 decided 2026-09-20)*
- [x] Security issues documented without secret contents
- [x] SEC-001 / SEC-002 / SEC-003: PEM and `local.db` removed from HEAD; `*.pem` / `*.db` gitignored (history **not** purged)
- [ ] SEC-004 human rotation of Enable Banking key in the provider console
- [ ] Human approval of remaining Phase 0 decisions (coordinator)
- [ ] Then schedule blocked AUTH/DB items
