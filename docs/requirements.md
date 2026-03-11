# Chores - Working Requirements (Current Baseline)

## Purpose
- This file is a living, implementation-focused requirements doc for contributors and coding agents.
- It describes what is currently implemented in code, plus known gaps that affect planning.
- If code and this document disagree, treat code as source of truth and update this file.
- For a compact day-to-day version, use `docs/requirements-quick-reference.md`.

## Status
- Last reviewed against code: 2026-03-08.
- Product phase: MVP with active iteration.
- Current scope includes auth, households, members/invites, chores board UI, and account settings.

## Target Behavior vs Current Baseline
- Target (product intent): deterministic calendar recurrence, explicit conflict handling, and auditable state history.
- Current (implemented): lazy series generation + one sparse occurrence-exceptions table, optimistic UI updates, and replace-in-place exception writes.
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
  - `TODO-4`: household ownership and deletion lifecycle.
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
  - Revoke pending invite (owner/admin only).
  - Promote/demote member role (owner/admin only).
  - Remove member (owner/admin only).
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
- Dedicated skip/snooze UI workflow (API-level cancel is available).

## Domain Model (Current)

### Core entities
- `users`: authenticated users.
- `households`: shared container for chores and members.
- `household_memberships`: household membership with role (`owner`, `admin`, or `member`) and status (`active`).
- `household_member_invites`: Better Auth organization invitation records (status, expiry, inviter, recipient).
- `chores`: chore series definitions.
- `chore_occurrence_exceptions`: per-occurrence-start exceptions with `kind = state | canceled` plus optional status metadata.
- `delete_account_tokens`: one-time account deletion confirmation tokens.

### Chore terminology
- Series: the durable chore definition (`start_date`, `end_date`, `repeat_rule`, optional `series_end_date`).
- Occurrence day: calendar date returned by derived generation (no time-of-day).
- Exception: persisted one-off state or cancel record for one series/occurrence-start pair.

## Identity, Membership, and Household Rules
- A signed-in user can create additional households while already belonging to other active households.
- The household setup page is also the signed-in create-household entry point for existing members who want to add another household.
- `active_household_id` is the primary acting-household context.
- When `active_household_id` is missing or stale and the user has exactly one active household, the app may bootstrap from that sole membership.
- When multiple active households exist and no valid `active_household_id` is available, the user must choose a household before household-scoped actions continue.
- Household time zone is editable by owners/admins (not immutable in current implementation).
- Household create/update rejects invalid time zones with `400` (`Invalid time zone`) instead of silently coercing to `UTC`.
- When an authenticated user has no active household, household-gated APIs return `403` with `error: "Household required"` and `code: "HOUSEHOLD_REQUIRED"`.
- Client fetch flows that lose household context mid-request should branch on `code` and recover to `/household/setup` for `HOUSEHOLD_REQUIRED`, or `/household/select` for `HOUSEHOLD_SELECTION_REQUIRED` and `HOUSEHOLD_NOT_FOUND`.
- Signed-in users without an active household remain in onboarding and should be redirected to household setup until they create or join their first household.
- Settings, profile, and board pages stay household-gated; only auth, invite acceptance, and household setup remain available during onboarding.
- Public entry points like `/` and `/auth` should immediately redirect signed-in users to `/household`, `/household/select`, or `/household/setup` based on active-household state and onboarding completeness.
- Default magic-link sign-in should return through an entry point that applies the same onboarding redirect policy; invite sign-in should keep its explicit callback to `/api/households/invites/complete`.
- Non-admin members can invite and resend invites.
- Only owners/admins can:
  - Edit household details.
  - Revoke invites.
  - Change member roles.
  - Remove members.
- Only owners can delete a household.
- A household can be deleted only when the acting owner is its only active member.
- Users cannot change their own role through the members API.
- Household administrators cannot remove themselves through the members API.
- There is currently no dedicated self-leave or owner-transfer API; when either flow is added, it must reconcile `active_household_id` using the same stale-session healing rules as other household membership changes.
- Admins cannot manage owner memberships or owner-role invites (assign, demote, remove, resend, revoke).

## Invite Rules
- Household invite links require Better Auth `invitationId + secret` and pending-status expiry checks (7 days).
- Invite create/resend delivery is best-effort: APIs return `ok: true` even when SMTP send fails, with `inviteEmailSent: false` in the response.
- Accepting invite with active session:
  - Succeeds only when signed-in email matches invite email.
  - Can add the user to another household and switch active context to the accepted household.
- Accepting invite without valid matching session:
  - Redirects to magic-link sign-in with callback to `/api/households/invites/complete?invitationId=...&secret=...`.

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
- API/storage `endDate` is exclusive and must be after `startDate`.
- `seriesEndDate` is allowed only when repeat is not `none`.
- `seriesEndDate` must be on or after `startDate` when provided.
- `notes` is trimmed and capped at 500 chars.

### Occurrence generation behavior
- Occurrences are generated lazily from series plus sparse occurrence exceptions.
- Generation is date-only and timezone-aware (household timezone).
- API/storage `endDate` is exclusive and defines span length (`startDate=2026-01-01`, `endDate=2026-01-02` is a one-day occurrence).
- `repeatRule = none` still supports multi-day span via `endDate`.
- `seriesEndDate = null` means no explicit repeat end, but returned data is still bounded by requested query range.
- Week view request defaults to household-local Monday-Sunday for the requested `weekOffset`.
- List responses include:
  - `occurrence_date`: day cell used for calendar grouping.
  - `occurrence_start_date`: recurrence instance identity used for set/cancel actions.

### Completion behavior
- `close_on_done`:
  - Mark done writes exception `kind = state`, `status = closed`, `closed_reason = done`.
- `stay_open`:
  - Mark done writes exception `kind = state`, `status = open`, `closed_reason = done`.
- Repeated logging is allowed.
- `action=set` must target a valid generated occurrence start date for that chore series.

### Cancellation behavior
- `action=cancel` requires `scope=single|following|all`.
- `scope=single` upserts an occurrence exception with `kind = canceled` for one instance.
- `scope=following` is allowed only for repeating chores and truncates the series by setting `series_end_date` to one day before the targeted occurrence start date.
- If `scope=following` targets the first occurrence in the series, it falls through to the same whole-series result as `scope=all`.
- `scope=all` cancels the entire source series by marking the series row canceled.
- `action=set` on excluded occurrences returns conflict.
- Mutation payloads use `occurrenceStartDate` (not `occurrenceDate`).

### Edit behavior
- `action=edit` requires `scope=single|following|all`.
- `scope=single` creates a detached one-off chore row and marks the targeted original occurrence canceled.
- `scope=following` is allowed only for repeating chores, truncates the original series at the day before the targeted occurrence, and creates a new future series row.
- If `scope=following` targets the first occurrence in the series, it falls through to the same whole-series result as `scope=all`.
- `scope=all` updates the existing series row in place and keeps the recurrence chain intact.
- Edit actions accept the same chore fields as create; omitted fields fall back to the source series/occurrence defaults.

### UI interaction constraints
- Add-chore and edit/cancel actions remain available for past dates; only the primary done/open action is currently blocked for past-dated occurrences.
- Primary action in chore details is disabled for past-dated occurrences.
- In the create/edit modal, the end-date input is inclusive; the UI converts it to the exclusive API/storage `endDate` internally.
- In the create/edit modal, repeating chores default `Repeat ends` to `Never`; selecting `On date` reveals the repeat-end date field and sends `seriesEndDate`.
- On the weekly board, all chores render once in a shared board area over the original day-column backgrounds; single-day chores occupy one day and multi-day chores span across days.
- Chores that start before or end after the visible week use a clipped edge treatment on the continued side (no outer corner radius and no outer vertical border).
- In the sidebar Today list, multi-day chores are collapsed to a single entry per occurrence and may reuse the same compact single-card styling as one-day chores.
- Single click on a board chore opens a compact preview popover with title, date span, repeat cadence, and notes; clicking the metadata block expands inline editing UI for date/repeat fields without persisting changes yet, and double click opens the full chore details modal.

## API Surface (Current Snapshot)
- Failure envelope contract: API routes return `{ ok: false, code: string, error: string }` for handled errors.
- `GET /api/health`
  - DB heartbeat check.
- `GET /api/households`
  - Returns active household summary for current user.
- `POST /api/households/active`
  - Sets the active household for the current session.
- `POST /api/households`
  - Creates household + owner membership, then switches session active household to the new household.
  - If the follow-up active-household session switch fails, the route attempts a compensating household delete and restores the previous active household when one existed before returning `500` with `Failed to activate new household`.
  - If both activation and compensating delete fail, the route returns `500` with `Failed to activate new household and roll back create`.
- `PATCH /api/households`
  - Updates household (owner/admin only).
- `DELETE /api/households`
  - Deletes the active household (owner only, and only when no other active members remain).
  - Clears active context, redirects to `/household/setup` when none remain, `/household/select` when multiple remain, and re-activates the sole remaining household when possible.
  - If sole-remaining-household activation fails, response still succeeds with `nextPath: "/household"`; page/API bootstrap fallback can still resolve the only remaining household, and session healing is best-effort until a later household-scoped API request.
  - If the remaining-households lookup itself fails after delete, response still succeeds but falls back to `nextPath: "/household/select"`.
- `GET /api/households/members`
  - Returns active members and pending invites.
- `POST /api/households/members`
  - Creates invite for email.
- `PATCH /api/households/members`
  - Updates member role (owner/admin only).
- `DELETE /api/households/members`
  - Removes member (owner/admin only).
- `POST /api/households/members/invites/[inviteId]`
  - Resends pending invite.
- `DELETE /api/households/members/invites/[inviteId]`
  - Revokes pending invite (owner/admin only).
- `POST /api/households/invites/accept`
  - Accept now if session/email matches, otherwise return sign-in redirect URL.
- `GET /api/households/invites/complete`
  - Completes invite acceptance after auth verification callback.
- `GET /api/chores`
  - Returns derived chores in requested date range.
- `PATCH /api/chores`
  - `action=create`: create series.
  - `action=set`: mark occurrence done/open.
  - `action=cancel`: cancel one occurrence (`single`), this and future chores (`following`), or the entire series (`all`).
  - `action=edit`: edit one occurrence (`single`), this and future chores (`following`), or the entire series (`all`).
- `GET /api/me`
  - Returns current user and memberships.
  - Reconciles stale `active_household_id` when request headers are available.
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
- Delete request is blocked when the user owns any household that still has other active members.
- Delete request email delivery is required: when confirmation email send fails, API returns `500` with `Failed to send confirmation email`.
- Confirmation uses one-time token (`identifier + tokenHash`) and expires in 30 minutes.
- Confirmation is also blocked when the user still owns any household that has other active members; valid tokens are not consumed in that case.
- On confirmed delete:
  - User row is removed.
  - Any households that become empty (no active memberships) are also removed.
- Current remediation is limited: owner transfer is not implemented yet, so blocked owners can remove other active members but cannot complete a transfer flow in-app today.

## Planned Ownership and Deletion Rules
- Deleting a user's last household should leave the user in onboarding with no active household; they may create a new household afterward.
- When an active household is deleted or the user's membership in it ends, `active_household_id` must be cleared or re-resolved before the next household-scoped action.
- Multi-household support should treat `active_household_id` as the acting context; membership list and ownership checks must be evaluated against the targeted household, not inferred by latest membership.

## Code Organization Conventions
- Keep route handlers transport-focused (auth, parsing, response mapping).
- Keep SQL/data access in `src/lib/repositories/*-repository.ts`.
- Keep domain logic in `src/lib/services/*-service.ts`.
- Use barrel exports from `src/lib/repositories/index.ts` and `src/lib/services/index.ts`.

## Testing and Quality Gates
- Prefer focused unit tests for service and route behavior.
- Colocate tests with the source they validate (for example `route.ts` with `route.test.ts`).
- Mock repositories in service tests; avoid DB in unit tests.
- Project default gate for code changes: `make dev-fix` (format, lint fix, tests, typecheck).
- Coverage expansion is tracked in `TODO-1` (Postgres-backed integration tests plus minimal auth/chore/account-deletion E2E flow).

## Known Gaps and Implementation Caveats
- Concurrency conflict semantics are not implemented as explicit retryable conflicts; current writes are effectively last-write-wins for exception upserts.
- No dedicated event/audit history table exists for chore state transitions; only latest exception state is stored.
- `closed_reason = schedule_end` lifecycle is not currently persisted by background process; closure is mostly represented by derived listing behavior.
- Monthly/yearly recurrence currently advances from the previous generated date; this can drift from original start-date anchoring in edge cases (for example 31st or leap-day patterns).
- Cancel actions are available from the board chore details modal for single-occurrence, this-and-following, and whole-series cancellation.
- Server-enforced completion undo is currently disabled; `UndoToastStack` remains in the codebase but is not wired into the board UI.
- Some data invariants are enforced at app-validation level rather than strict DB constraints; staged hardening is tracked in `TODO-3`.

## Decision Notes for Future Work
- If recurrence behavior is changed, update both `generateOccurrences` and tests first, then align API and UI assumptions.
- If auditability becomes mandatory, introduce append-only event storage instead of relying on exception row replacement.
