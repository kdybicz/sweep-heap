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

## TODO-4 - Household Ownership and Deletion Lifecycle
- Requirement links:
  - [Identity, Membership, and Household Rules](requirements.md#identity-membership-and-household-rules)
  - [Account Deletion Requirements (Current)](requirements.md#account-deletion-requirements-current)
  - [Planned Ownership and Deletion Rules](requirements.md#planned-ownership-and-deletion-rules)
- Scope:
  - Add owner-only household deletion, including the rule that a household cannot be deleted while other active members remain.
  - Ensure active-household state is cleared or re-resolved when memberships or households are removed.
  - Block account deletion for owners while their household still contains other active members.

## TODO-5 - Household Create/Activate Atomicity
- Requirement links:
  - [Identity, Membership, and Household Rules](requirements.md#identity-membership-and-household-rules)
  - [API Surface (Current Snapshot)](requirements.md#api-surface-current-snapshot)
  - [Known Gaps and Implementation Caveats](requirements.md#known-gaps-and-implementation-caveats)
- Scope:
  - Eliminate partial-success behavior where household creation succeeds in storage but active-household session switching fails afterward.
  - Define an atomic or compensating strategy for create-and-activate so users never end up with a hidden newly created household after a failed activation step.
