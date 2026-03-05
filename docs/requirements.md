# Chores - Working Requirements (Current Baseline)

## Purpose
- This file is a living, implementation-focused requirements doc for contributors and coding agents.
- It describes what is currently implemented in code, plus known gaps that affect planning.
- If code and this document disagree, treat code as source of truth and update this file.
- For a compact day-to-day version, use `docs/requirements-quick-reference.md`.

## Status
- Last reviewed against code: 2026-03-05.
- Product phase: MVP with active iteration.
- Current scope includes auth, households, members/invites, chores board UI, and account settings.

## Target Behavior vs Current Baseline
- Target (product intent): deterministic calendar recurrence, explicit conflict handling, and auditable state history.
- Current (implemented): lazy series generation + overrides, optimistic UI updates, 5-second undo window, and replace-in-place override writes.
- Important deltas to keep visible:
  - Recurrence can drift in some month/year edge cases.
  - There is no append-only chore event history yet.
  - Concurrency is not surfaced as explicit retryable conflict responses.
- Working rule for contributors: preserve current behavior unless a change is intentional, tested, and documented here.

## Requirements and TODO Integration
- `docs/requirements.md` is the stable source for current behavior, constraints, and known gaps.
- `docs/todo.md` is the execution backlog and sequencing plan.
- Stable TODO IDs:
  - `TODO-1`: integration and end-to-end coverage hardening.
  - `TODO-2`: API rate limiting and abuse protections.
  - `TODO-3`: stricter DB constraints with a staged migration rollout.
- Workflow rule: when completing a TODO item, update this file in the same change if behavior, constraints, or caveats changed.

## Tech and Architecture Baseline
- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- Auth: Better Auth magic-link flow (email-based sign in).
- Backend: Next.js route handlers under `src/app/api/**/route.ts`.
- Data: PostgreSQL, with Drizzle migrations/schema and repository modules using SQL queries.
- Testing: Vitest (`*.test.ts`, `*.test.tsx`) in node environment.
- Package manager: Yarn 4.

## Product Scope

### In scope now
- Magic-link sign in, sign out, and invite-based sign-in handoff.
- Household setup and editing (name, icon, time zone).
- Household member management:
  - Invite by email.
  - Resend pending invite.
  - Revoke pending invite (admin only).
  - Promote/demote member role (admin only).
  - Remove member (admin only).
- Weekly chore board:
  - Create chore series.
  - View chores for week and for today.
  - Mark occurrence done.
  - Undo recent done action with countdown bar.
- User profile update (name), appearance settings (system/light/dark), account deletion confirmation flow.
- Health endpoint for DB connectivity.

### Out of scope now
- Points, rankings, approvals, and other gamification mechanics.
- Private chores visible only to a subset of household members.
- Smart home integrations and monetization.
- Advanced recurrence customizations (weekday sets, arbitrary intervals, etc.).
- Functional skip/snooze workflow (buttons exist in UI but no backend behavior yet).

## Domain Model (Current)

### Core entities
- `users`: authenticated users.
- `households`: shared container for chores and members.
- `household_memberships`: household membership with role (`admin` or `member`) and status (`active`).
- `household_member_invites`: invite records with token hash, expiry, optional accept metadata.
- `chores`: chore series definitions.
- `chore_occurrence_overrides`: per-date exceptions (status, reason, undo window).
- `delete_account_tokens`: one-time account deletion confirmation tokens.

### Chore terminology
- Series: the durable chore definition (`start_date`, `end_date`, `repeat_rule`, optional `series_end_date`).
- Occurrence day: calendar date returned by derived generation (no time-of-day).
- Override: persisted exception for one series/date pair.

## Identity, Membership, and Household Rules
- A signed-in user can create a household only when they currently have no active memberships.
- Active household is derived as the latest active membership by `joined_at`.
- Household time zone is editable by admins (not immutable in current implementation).
- Non-admin members can invite and resend invites.
- Only admins can:
  - Edit household details.
  - Revoke invites.
  - Change member roles.
  - Remove members.
- Safety rule: at least one admin must remain in a household.
- Admins cannot change their own role through the members API.
- Admins cannot remove themselves through the members API.

## Invite Rules
- Household invite token links are backed by `identifier + tokenHash` and expire after 7 days.
- Accepting invite with active session:
  - Succeeds only when signed-in email matches invite email.
  - Fails with conflict if signed-in user belongs to another household.
- Accepting invite without valid matching session:
  - Starts magic-link verification handoff.
  - Temporary verification token expires after 10 minutes.

## Chore Rules (Implemented)

### Chore series fields
- Required: `title`, `type`, `startDate`, `endDate`, `repeatRule`.
- Optional: `seriesEndDate`, `notes`.
- Allowed `type`: `close_on_done`, `stay_open`.
- Allowed `repeatRule` (normalized): `none`, `day`, `week`, `biweek`, `month`, `year`.
- Accepted input aliases: `daily`, `weekly`, `biweekly`, `monthly`, `yearly`.

### Validation at create time
- `title` required.
- `type` must be valid.
- `startDate` and `endDate` required.
- `startDate` and `endDate` cannot be before household-local `today`.
- `endDate` must be on or after `startDate`.
- `seriesEndDate` is allowed only when repeat is not `none`.
- `seriesEndDate` must be on or after `startDate` when provided.
- `notes` is trimmed and capped at 500 chars.

### Occurrence generation behavior
- Occurrences are generated lazily from series plus overrides.
- Generation is date-only and timezone-aware (household timezone).
- `endDate` defines span length; one occurrence can contribute multiple calendar days.
- `repeatRule = none` still supports multi-day span via `endDate`.
- `seriesEndDate = null` means no explicit repeat end, but returned data is still bounded by requested query range.
- Week view request defaults to household-local Monday-Sunday for the requested `weekOffset`.

### Completion and undo behavior
- `close_on_done`:
  - Mark done writes override `status = closed`, `closed_reason = done`.
- `stay_open`:
  - Mark done writes override `status = open`, `closed_reason = done`.
  - Repeated logging is allowed.
- Undo window is 5 seconds (not 10 seconds).
- `action=undo` is enforced against `undo_until` and returns conflict after the window expires.
- Undo action deletes the override row for that occurrence.
- UI shows active undo toasts with a visible countdown bar.

### UI interaction constraints
- Add-chore buttons are disabled for past dates.
- Primary action in chore details is disabled for past-dated occurrences.

## API Surface (Current Snapshot)
- `GET /api/health`
  - DB heartbeat check.
- `GET /api/households`
  - Returns active household summary for current user.
- `POST /api/households`
  - Creates household + owner membership.
- `PATCH /api/households`
  - Updates household (admin only).
- `GET /api/households/members`
  - Returns active members and pending invites.
- `POST /api/households/members`
  - Creates invite for email.
- `PATCH /api/households/members`
  - Updates member role (admin only).
- `DELETE /api/households/members`
  - Removes member (admin only).
- `POST /api/households/members/invites/[inviteId]`
  - Resends pending invite.
- `DELETE /api/households/members/invites/[inviteId]`
  - Revokes pending invite (admin only).
- `POST /api/households/invites/accept`
  - Accept now if session/email matches, otherwise return sign-in redirect URL.
- `GET /api/households/invites/complete`
  - Completes invite acceptance after auth verification callback.
- `GET /api/chores`
  - Returns derived chores in requested date range.
- `PATCH /api/chores`
  - `action=create`: create series.
  - `action=set`: mark occurrence done/open.
  - `action=undo`: clear occurrence override.
- `GET /api/me`
  - Returns current user and memberships.
- `PATCH /api/me`
  - Updates current user name.
- `POST /api/me/delete-request`
  - Creates and emails delete confirmation token (30 min expiry).
- `POST /api/me/delete-confirm`
  - Consumes token and deletes user account.

## Operational and Abuse-Prevention Guardrails
- Current baseline:
  - No dedicated app-level API rate limiting middleware is implemented.
  - Protection mainly relies on authentication checks and route-level validation.
- Planned hardening (`TODO-2`):
  - Add shared rate limiting for sensitive routes (magic link auth, household invite create/resend, account deletion request/confirm).
  - Optionally complement with edge/WAF protections.

## Account Deletion Requirements (Current)
- Delete request requires authenticated user with an email.
- Confirmation uses one-time token (`identifier + tokenHash`) and expires in 30 minutes.
- On confirmed delete:
  - User row is removed.
  - Any households that become empty (no active memberships) are also removed.

## Code Organization Conventions
- Keep route handlers transport-focused (auth, parsing, response mapping).
- Keep SQL/data access in `src/lib/repositories/*-repository.ts`.
- Keep domain logic in `src/lib/services/*-service.ts`.
- Use barrel exports from `src/lib/repositories/index.ts` and `src/lib/services/index.ts`.

## Testing and Quality Gates
- Prefer focused unit tests for service and route behavior.
- Mock repositories in service tests; avoid DB in unit tests.
- Project default gate for code changes: `yarn dev:fix` (format, lint fix, tests, typecheck).
- Coverage expansion is tracked in `TODO-1` (Postgres-backed integration tests plus minimal auth/chore/account-deletion E2E flow).

## Known Gaps and Implementation Caveats
- Concurrency conflict semantics are not implemented as explicit retryable conflicts; current writes are effectively last-write-wins for override upserts.
- No dedicated event/audit history table exists for chore state transitions; only latest override state is stored.
- `closed_reason = schedule_end` lifecycle is not currently persisted by background process; closure is mostly represented by derived listing behavior.
- Monthly/yearly recurrence currently advances from the previous generated date; this can drift from original start-date anchoring in edge cases (for example 31st or leap-day patterns).
- For repeating multi-day chores, generation is clamped by `seriesEndDate` date boundary, so span days after the final start date may not be included.
- Some data invariants are enforced at app-validation level rather than strict DB constraints; staged hardening is tracked in `TODO-3`.

## Decision Notes for Future Work
- If recurrence behavior is changed, update both `generateOccurrences` and tests first, then align API and UI assumptions.
- If auditability becomes mandatory, introduce append-only event storage instead of relying on override row replacement.
