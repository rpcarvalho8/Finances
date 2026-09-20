# SECURITY_AUDIT

Evidence-based findings. **No private key material, no password values, and no full transaction dumps are included.**

Severity: **Critical** / **High** / **Medium** / **Low** / **Info**.

---

## SEC-A01 — PKCS#8 private key committed to git (Critical)

- **File (tracked):** `e05443a5-b2a3-454d-9f7a-703fb7e9a0ad.pem`
- **Size:** 3271 bytes, 51 lines
- **Header (type only):** `-----BEGIN PRIVATE KEY-----` (unencrypted PKCS#8; `file(1)` reports a private key with no password)
- **Wiring:** `app/api/sync/bank/init/route.ts` default `CLIENT_ID` is the UUID that matches this filename. `getPrivateKey()` reads `${CLIENT_ID}.pem` from `process.cwd()`, then **any `*.pem` in the project root**.
- **`.gitignore`:** does **not** ignore `*.pem`.
- **Impact:** Anyone with repo read access can impersonate the Enable Banking application (sign RS256 client JWTs). Treat the key as **compromised**. Rotation must happen **outside** this docs PR (human + Enable Banking console).

Do not paste the key into issues, chat, or these docs. Do not “fix” by rewriting git history in Phase 0 without approval (Decision SEC-D01).

---

## SEC-A02 — SQLite database file committed to git (High)

- **File (tracked):** `local.db` (57 344 bytes)
- **Role:** experimental schema from `test-init.js`, not the app’s intended `data/finance.db`
- **Contents:** 4 transactions, 1 goal (`Conta Pessoal 10k` / owner `Rui`), business names, category labels “Trading Forex” / “Crypto”
- **`.gitignore`:** ignores `data/*.db` only
- **Impact:** even a small DB in git can leak amounts and labels; it also trains clones to commit DB files. Seed data in `scripts/seed.ts` is a related PII issue (SEC-A08) even though it is TypeScript, not SQLite.

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

`app/api/sync/bank/init/route.ts`:

- Fallback application key UUID (same as PEM filename)
- Fallback redirect `https://small-bats-appear.loca.lt/api/sync/bank/callback`

`loca.lt` tunnels are typically **unauthenticated public URLs**. If that tunnel is reused, OAuth codes can be stolen (authorization code interception). `NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY` being public-by-design plus a committed private key is a complete client credential pair.

Init also logs `CLIENT_ID`, candidate key paths, JWT header/payload, and a prefix of the signature input.

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

- Rotate the Enable Banking key
- `git filter-repo` the PEM/DB out of history
- Add authentication
- Change `.gitignore` **wait** — user said docs only, no refactors of app/lib/components/scripts except docs. **Do not edit `.gitignore` in this PR** even though that is a one-line security improvement. Record as SEC-003 blocked on approval.

Human approval required before any destructive secret remediation (see [DECISIONS.md](./DECISIONS.md)).
