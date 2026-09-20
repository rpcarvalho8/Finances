# SECURITY_AUDIT

Evidence-based findings. **No private key material, no password values, and no full transaction dumps are included.**

**2026-09-20 remediation (SEC-D01 option 1 + SEC-D02):** the Enable Banking PEM and `local.db` were deleted from HEAD in a forward commit; `.gitignore` now covers `*.pem`, `*.db`, and `local.db`. Init no longer falls back to the burned application UUID or a `loca.lt` redirect. **Git history still contains both secrets at commit `170427a`.** Treat the old key as burned. **A human must rotate** the Enable Banking application key/keypair in the provider console (SEC-004). History rewrite / force-push was explicitly **not** done.

Severity: **Critical** / **High** / **Medium** / **Low** / **Info**.

---

## SEC-A01 — PKCS#8 private key committed to git (Critical)

- **File (tracked at audit):** `e05443a5-b2a3-454d-9f7a-703fb7e9a0ad.pem` — **removed from HEAD on 2026-09-20** (SEC-D01 option 1). Still present in git history at `170427a`.
- **Size:** 3271 bytes, 51 lines
- **Header (type only):** `-----BEGIN PRIVATE KEY-----` (unencrypted PKCS#8; `file(1)` reports a private key with no password)
- **Wiring (after 2026-09-20):** `app/api/sync/bank/init/route.ts` requires `ENABLE_BANKING_APPLICATION_KEY` and `ENABLE_BANKING_REDIRECT_URI` (fail closed). Private key from `ENABLE_BANKING_APPLICATION_SECRET` or `ENABLE_BANKING_PRIVATE_KEY_PATH` only — **no** cwd `*.pem` scan and **no** `${CLIENT_ID}.pem` lookup.
- **`.gitignore`:** ignores `*.pem` (as of 2026-09-20).
- **Impact:** Anyone with repo **history** access can still impersonate the old Enable Banking application. Treat the key as **compromised**. Rotation must happen **outside** git (human + Enable Banking console, SEC-004).

Do not paste the key into issues, chat, or these docs. History rewrite was **not** performed (Decision SEC-D01 option 1).

---

## SEC-A02 — SQLite database file committed to git (High)

- **File (tracked at audit):** `local.db` (57 344 bytes) — **removed from HEAD on 2026-09-20** (SEC-D02). Still present in git history at `170427a`.
- **Role:** experimental schema from `test-init.js`, not the app’s intended `data/finance.db`
- **Contents:** 4 transactions, 1 goal (`Conta Pessoal 10k` / owner `Rui`), business names, category labels “Trading Forex” / “Crypto”
- **`.gitignore`:** ignores `*.db`, `local.db`, and `data/*.db` (as of 2026-09-20)
- **Impact:** even a small DB in git history can leak amounts and labels. Seed data in `scripts/seed.ts` is a related PII issue (SEC-A08) even though it is TypeScript, not SQLite.

---

## SEC-A03 — No application authentication (Critical)

- No `middleware.ts`, no login page, no session cookie, no CSRF tokens.
- Env names `AUTH_SECRET`, `RUI_PASSWORD`, `ANA_PASSWORD` appear in `.env.example` and `scripts/setup-ubuntu.sh` **only**. Zero application reads.
- `users.password_hash` column is unused.

**Impact:** every API below is world-writable if the port is reachable (LAN, tunnel, VPS).

Unauthenticated write/read examples:

| Path | Risk |
| --- | --- |
| `GET/POST /api/transactions` | Full ledger |
| `DELETE /api/transactions/[id]` | Destroy data; no owner check |
| `POST /api/settings/api-keys` | Overwrite broker/Anthropic keys |
| `GET /api/backup` | Download entire DB file |
| `POST /api/ai-advisor` | Exfiltrate finances to a third-party LLM on attacker’s question |
| `POST /api/sync/bank/init` | Start bank consent with committed app key |
| `GET /api/sync/bank/callback` | Completes OAuth if attacker obtains `code` |

---

## SEC-A04 — API keys stored in plaintext SQLite (High)

`app/api/settings/api-keys/route.ts`:

```ts
INSERT INTO api_keys (platform, api_key, api_secret, extra) VALUES (?,?,?,?)
ON CONFLICT(platform) DO UPDATE SET ...
```

Settings UI posts XTB password, Bybit/Binance secrets, Anthropic key. Combined with `/api/backup` this is a one-request credential dump.

---

## SEC-A05 — Bank access tokens stored in plaintext (High)

`app/api/sync/bank/callback/route.ts` inserts `accessToken` into `bank_accounts.access_token`. Every successful callback **deletes all rows** then re-inserts. Tokens also appear in server logs (`Token obtained successfully`, JWT header/payload dumps in init).

---

## SEC-A06 — Hardcoded Enable Banking client id + localtunnel redirect (High)

**Status (2026-09-20):** code defaults removed from `app/api/sync/bank/init/route.ts`. Init now requires `ENABLE_BANKING_APPLICATION_KEY` and `ENABLE_BANKING_REDIRECT_URI` (fail closed). Residual risk: the burned UUID and `loca.lt` hostname remain in **git history** (`170427a`) and must not be reused.

Originally:

- Fallback application key UUID (same as PEM filename)
- Fallback redirect `https://small-bats-appear.loca.lt/api/sync/bank/callback`

`loca.lt` tunnels are typically **unauthenticated public URLs**. If that tunnel is reused, OAuth codes can be stolen (authorization code interception). `NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY` being public-by-design plus a committed private key is a complete client credential pair.

Init previously logged `CLIENT_ID`, candidate key paths, JWT header/payload, and a prefix of the signature input (reduced 2026-09-20; do not log private key material).

---

## SEC-A07 — AI path sends raw ledger to Anthropic without auth or redaction (High)

`app/api/ai-advisor/route.ts` runs SQL then interpolates:

- Hardcoded salary split for Rui/Ana
- All investment platform names and EUR values
- Goal names and saved/target
- Last 12 transaction **descriptions and amounts** (merchants, employers)
- LUMEU vendor spend

No gateway, no field allowlist, no hashing of counterparties, no user consent prompt beyond using the page. The model is `claude-sonnet-4-20250514`.

LLM does not execute transfers (no tools) — that part of the target policy is vacuously held.

---

## SEC-A08 — Household PII in `scripts/seed.ts` (High)

Seed contains full names, employer names, salary amounts, merchants, and locations. That file is the initial commit on a GitHub repo. Even if the GitHub repo is private, forks, CI logs, and this cloud agent clone replicate it.

Phase 0 does **not** rewrite seed (would be an application/data change). Decision SEC-D03: anonymize vs keep as private household seed.

---

## SEC-A09 — Weak demo passwords in setup script (Medium)

`scripts/setup-ubuntu.sh` writes `.env.local` with `RUI_PASSWORD=rui123`, `ANA_PASSWORD=ana123`, `AUTH_SECRET=dev-secret-finance-os-2026` if missing. Those passwords are unused today, but they will become live if Auth is implemented without changing the script.

---

## SEC-A10 — Next.js 14.2.3 known advisories (High / Critical depending on advisory)

`npm audit` on a clean install in Phase 0: **9** issues (1 critical, 5 high, 1 moderate, 2 low).

Installer also prints: Next 14.2.3 is deprecated pending a security update (cache poisoning / related GHSA on `next`). Recharts 2.x is deprecated (Trade page only).

Upgrading Next is **not** Phase 0 (application change). Track as SEC-001 family, blocked on approval.

---

## SEC-A11 — Backup endpoint is an unauthenticated file read (High)

`app/api/backup/route.ts` reads `DATABASE_URL` with `.replace('file:','')` and returns `application/octet-stream`. Combined with A03 this is a full DB exfil. Path is not constrained to `data/`.

---

## SEC-A12 — Verbose secrets-adjacent logging (Medium)

Bank init logs JWT construction. Callback logs first 10 chars of OAuth `code`. `console.error` of Enable Banking error **body** may include provider messages. AI route has no structured audit log of what left the box.

---

## SEC-A13 — Import of `app/lib/enablebanking.ts` / `gocardless.ts` would crash the process (Info / reliability)

Both files `throw new Error('Missing … credentials')` at **module load**. They are currently unimported. If a future page imports them without env, the server fails closed — good for missing secrets, bad for accidental import. They also document in-memory token caches (not encrypted).

---

## SEC-A14 — HMAC vs JWT mismatch on Enable Banking callback (Medium, correctness + security)

Init signs RS256 JWTs with the PEM. Callback `exchangeCodeForToken` HMAC-SHA256s the body with `ENABLE_BANKING_APPLICATION_SECRET` and requires `NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY`. Two different credential models in one flow — likely broken in production, or one path uses the PEM as HMAC secret (misuse of an RSA key).

---

## SEC-A15 — No authorization on object IDs (High)

`DELETE /api/transactions/[id]`, investments, goals, lumeu: numeric/text id only. With no users this is equivalent to A03; after Auth is added, IDOR will remain unless ownership checks are introduced.

---

## SEC-A16 — Claude local settings committed (Low)

`.claude/settings.local.json` is tracked (empty allow-list of bash commands). Not a secret, but local agent config usually should not be in the default branch.

---

## What Phase 0 will not do

- Rotate the Enable Banking key **in the provider console** (still human, SEC-004)
- `git filter-repo` the PEM/DB out of history (explicitly declined; SEC-D01 option 1)
- Add authentication

Phase 0 docs did not edit `.gitignore` or application code. The 2026-09-20 follow-up **did** delete the PEM and `local.db` from HEAD, tighten `.gitignore`, and fail-close Enable Banking init. Human approval remains required for console rotation and any future history purge.
