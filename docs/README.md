# Finance OS — Phase 0 documentation pack

This folder is the **Phase 0 (audit + planning)** output for [rpcarvalho8/Finances](https://github.com/rpcarvalho8/Finances). It describes the **real repository**, compares it to a **target** Finance OS architecture, and records decisions that need human approval.

**No application code was changed in Phase 0.** These files are documentation only.

## How to read this pack

| Order | File | Purpose |
| --- | --- | --- |
| 1 | [PROJECT_CONFIG.md](./PROJECT_CONFIG.md) | Repo URL, branch, commit SHA, remotes, stack facts |
| 2 | [PROJECT_STATE.md](./PROJECT_STATE.md) | What the app actually is today |
| 3 | [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) | Real architecture vs target domains/layers |
| 4 | [DATABASE_AUDIT.md](./DATABASE_AUDIT.md) | Schema sources, dual DBs, missing migrations |
| 5 | [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Evidence-based security findings (no secret material) |
| 6 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Target architecture + migration path from the real state |
| 7 | [SECURITY.md](./SECURITY.md) | Target security policy for later phases |
| 8 | [DECISIONS.md](./DECISIONS.md) | Open decisions marked **PENDING** |
| 9 | [BACKLOG.md](./BACKLOG.md) | Phase 0 task IDs (audit closure + blocked remediations) |
| 10 | [ROADMAP.md](./ROADMAP.md) | Phased path after approval |
| 11 | [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | Planner vs Cursor executor lifecycle |

## Status of this phase

- **Phase:** 0 — inspect + plan
- **Implementation:** blocked until a human approves Phase 0 (see [DECISIONS.md](./DECISIONS.md))
- **Preserve rule:** preserve current working household UI → later refactor → later improve
- **Secrets:** do **not** paste key/PEM/password contents into issues, chats, or docs

## Language

UI copy and comments in the repo are mostly **Portuguese (pt-PT)**. This technical pack is written in **English** so architecture, security, and backlog IDs stay precise. Portuguese terms from the code (`rui`, `ana`, `conjunta`, `familia`, LUMEU) are kept as they appear in source.
