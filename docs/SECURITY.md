# SECURITY.md

**Target** security policy for Finance OS. This is not how the repo behaves today. Current gaps: [SECURITY_AUDIT.md](./SECURITY_AUDIT.md). Implementation is **out of scope for Phase 0**.

## Goals

1. Household financial data never leaves the trusted computing base without explicit, logged consent.
2. Secrets never live in git (history included).
3. The LLM cannot read the database, cannot call brokers, cannot move money.
4. Every mutating API requires an authenticated user and an authorization check against household membership.
5. Provider credentials are encrypted at rest and never returned to the browser after save.

## Authentication (target)

- Replace unused `RUI_PASSWORD` / `ANA_PASSWORD` env pair with a real user model (`users` table already sketched).
- Session: HTTP-only, Secure, SameSite=Lax (or Strict) cookie bound to `AUTH_SECRET` (or better, a dedicated session store).
- No password in git, seed, or setup scripts. Setup must generate a random `AUTH_SECRET` and refuse to start on the example values.
- Until Auth ships, the process must not be exposed on a public tunnel (`loca.lt` and similar are forbidden in production config).

## Authorization (target)

- Resource IDs are not capability tokens. `DELETE /api/transactions/:id` must verify `account.household_id` (or equivalent) matches the session.
- Bank consents, API keys, backups, and AI are **privileged** operations (household admin).
- Business entities (LUMEU, etc.) are scoped to a household, not global tables.

## Secrets (target)

| Secret | Storage |
| --- | --- |
| Anthropic API key | Env or OS keychain / secret manager — not SQLite plaintext |
| Broker API keys | Encrypted column (envelope encryption) or secret manager |
| Open Banking application private key | Env / file **outside** the repo, mode 600, never `NEXT_PUBLIC_*` |
| Open Banking user access tokens | Encrypted; short TTL; refresh path documented |
| SQLite file | Not committed; backups encrypted; `/api/backup` authn + authz |

`.gitignore` must include: `.env`, `.env.local`, `*.pem`, `*.db`, `*.db-journal`, `data/`, `backups/`.

If a secret was committed (PEM, `local.db`): **rotate**, then **purge history** (or declare the repo private forever and rotate anyway). Rotation is mandatory for the Enable Banking app key that matched the committed PEM filename.

## Open Banking (target)

- No hardcoded application id or tunnel redirect.
- Redirect URI allowlist on the provider console must match production/dev exactly.
- Consent records: subject user, ASPSP, scopes, expiry, status.
- Do not assign all imported movements to `owner='rui'`.
- Do not log JWTs, authorization codes, or access tokens.

## AI (target)

```
UI → authenticated API → AI Gateway
                         ├─ policy: no tools that mutate money
                         ├─ redaction / aggregation
                         └─ Context Engine (reads Finance OS via services, not raw SQL in the LLM process)
                              → Financial Engine / Analytics read models
```

Rules:

- The LLM process receives **only** a compiled context document (aggregates, category totals, anonymized merchants if required).
- The Gateway strips account numbers, IBANs, full names of third parties where possible.
- No `SELECT * FROM transactions` inside the model-calling route.
- User must be able to disable AI and to see “what was sent” (audit).
- AI never executes transfers, never writes transactions, never calls brokers.

## Logging (target)

- Do not log secrets, JWTs, PEM paths with file contents, OAuth codes.
- Do log: actor id, action, resource type, success/fail (security audit trail).
- Request IDs on API errors returned to the client; stack traces only server-side.

## Dependencies (target)

- Stay on a **supported** Next.js release (14.2.3 is flagged in `npm audit` / vendor advisory).
- Add `npm audit` (or equivalent) to CI once CI exists.
- Pin and review native DB client (`@libsql/client`) upgrades.

## Backup & restore (target)

- Authenticated download or, preferably, CLI-only backups.
- Encrypted artifacts.
- Restore tested; seed data for demos is **synthetic**, not household history.

## Incident response (for the current repo)

Already true as of Phase 0 audit:

1. Assume the committed Enable Banking private key is public to anyone who cloned the repo.
2. Assume seed amounts and counterparties in `scripts/seed.ts` are in git history.
3. Human must decide: rotate keys, privatize repo, purge history, anonymize seed (Decision SEC-D01 / SEC-D03).

No further “quiet” commits of `.pem` or `*.db` files.
