# AGENT_PROTOCOL

How a **planner** (human coordinator / architect) and a **Cursor executor** (this class of coding agent) collaborate on Finance OS. Phase 0 exists so later agents do not “improve” the repo by inventing modules or leaking secrets.

## Roles

| Role | Owns | Must not |
| --- | --- | --- |
| **Planner** | Goals, phase gates, [DECISIONS.md](./DECISIONS.md) outcomes, what may be deleted from git history | Implement features in the same breath as undecided architecture |
| **Cursor executor** | Code/docs inside an approved task ID; evidence (paths, commands, PR) | Expand scope to “while we’re here” refactors; commit secrets; treat target architecture as already built |
| **Human household owner** | Real credentials, Enable Banking console, whether seed PII stays | Paste PEMs or live API keys into the agent chat or tickets |

## Lifecycle (every work increment)

```
1. Planner selects BACKLOG ids whose Dependencies are not blocked
2. Executor reads docs/PROJECT_STATE.md + the task’s Acceptance Criteria
3. Executor implements ONLY those files the task allows
4. Executor verifies (browser if UI; otherwise tests/curl) without committing secrets
5. Executor opens/updates a PR with the task IDs in the title/body
6. Planner reviews REAL vs TARGET; merges or requests changes
7. If a new architectural choice appears, executor STOPS and adds a PENDING decision
```

## Phase 0 rules (still apply to later agents until Phase 0 is approved)

- Documentation only, unless the planner explicitly opens Phase 0b security tasks.
- Do not refactor `app/`, `lib/`, `components/`, `scripts/` “to match ARCHITECTURE.md”.
- Do not delete or rewrite secrets; document them.
- Do not invent adapters for Revolut/OKX/Exodus/Kraken/Trading OS payloads that are not in the tree.

## Task contract (BACKLOG.md)

Every executor task must have:

- **Objective** — one outcome
- **Context** — pointers into this pack
- **Dependencies** — other IDs or PENDING decisions
- **Acceptance criteria** — testable
- **Risks** — especially destructive git/data/key rotation

If dependencies are `blocked`, the executor’s job is to **say so and stop**, not to guess the decision.

## Preserve → refactor → improve

1. **Preserve:** household screens keep working (Dashboard, person pages, investimentos, LUMEU, settings, advisor).
2. **Refactor:** introduce services/repositories **behind** existing Route Handlers; aliases for `/rui`.
3. **Improve:** new domains (net worth, gateway, adapters) after the above.

An executor must state which of the three a PR is. Mixing “improve” into a preserve PR is out of protocol.

## Secrets protocol

- Never print PEM bodies, `.env` values, or `api_keys` rows into docs, PR bodies, or logs.
- If a command would display a secret, stop and describe the file **path** only.
- New files: no `*.pem`, no `*.db`, no `.env` in git.
- If an executor finds a **new** committed secret, add a SECURITY_AUDIT finding and a PENDING decision; do not “quietly delete” without SEC-D01-style approval (history remains).

## AI protocol (product, not this coding agent)

- Product LLM must not gain DB credentials or broker tools.
- Coding agents may read `lib/db.ts` schema; they must not dump `local.db` transaction details into public PRs.

## Planner checklist before assigning implementation

- [ ] Phase 0 merged or explicitly waived
- [ ] Relevant DECISIONS.md IDs changed from PENDING to a recorded outcome
- [ ] BACKLOG id status is `open` not `blocked`
- [ ] Scope names the directories allowed to change
- [ ] Test/verification method is specified (many routes have no tests today)

## Executor checklist before opening a PR

- [ ] Branch named per current org policy
- [ ] Diff matches the task (docs-only stays docs-only)
- [ ] `git status` shows no accidental `.next/`, `node_modules/`, `.env`, `data/*.db`
- [ ] PR body: real state touched, risks, decisions still PENDING
- [ ] Did not “complete” a blocked security task by deleting keys without rotation notes

## Communication back to the coordinator

Use the nine-section report (current state, problems, critical risks, current architecture, proposed architecture, differences, Phase 0 backlog, dependencies, decisions). That report is the Phase 0 **hand-off**, not a license to start Phase 1.
