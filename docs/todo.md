# Future TODO

This file tracks execution backlog. Current behavior and constraints live in `docs/requirements.md`.
Use `docs/requirements-quick-reference.md` when you need the short version while planning tasks.

## TODO-1 - Integration and End-to-End Coverage
- Requirement links:
  - [Requirements and TODO Integration](requirements.md#requirements-and-todo-integration)
  - [Testing and Quality Gates](requirements.md#testing-and-quality-gates)
  - [API Surface (Current Snapshot)](requirements.md#api-surface-current-snapshot)
  - [Account Deletion Requirements (Current)](requirements.md#account-deletion-requirements-current)
- Scope:
  - Add Postgres-backed integration tests for repositories and API routes.
  - Add a minimal end-to-end flow for auth, chore lifecycle (`create`, `set`, `undo`), and account deletion (`delete-request`, `delete-confirm`).

## TODO-2 - Rate Limiting and Abuse Protections
- Requirement links:
  - [Requirements and TODO Integration](requirements.md#requirements-and-todo-integration)
  - [Operational and Abuse-Prevention Guardrails](requirements.md#operational-and-abuse-prevention-guardrails)
  - [Invite Rules](requirements.md#invite-rules)
  - [Account Deletion Requirements (Current)](requirements.md#account-deletion-requirements-current)
- Scope:
  - Add rate limiting via shared infrastructure (for example Redis/Upstash).
  - Evaluate and document edge/WAF protections as a complement.

## TODO-3 - Stricter DB Invariants with Staged Rollout
- Requirement links:
  - [Requirements and TODO Integration](requirements.md#requirements-and-todo-integration)
  - [Domain Model (Current)](requirements.md#domain-model-current)
  - [Chore Rules (Implemented)](requirements.md#chore-rules-implemented)
  - [Known Gaps and Implementation Caveats](requirements.md#known-gaps-and-implementation-caveats)
- Scope:
  - Revisit strict DB schema constraints (check constraints/enums/date invariants).
  - Define a staged migration/backfill strategy so constraints can be adopted safely.
