# Chores - Working Requirements (Current Baseline)

## Purpose
- This file is a living, implementation-focused requirements doc for contributors and coding agents.
- It describes what is currently implemented in code, plus known gaps that affect planning.
- If code and this document disagree, treat code as source of truth and update this file.
- For a compact day-to-day version, use `docs/requirements-quick-reference.md`.

## Status
- Last reviewed against code: 2026-10-11. See [the review evidence](reviews/2026-10-11.md) for confirmed defects and linked GitHub Issues.
- Product phase: MVP with active iteration.
- Current scope includes auth, households, members/invites, chores board UI, and account settings.

## Target Behavior vs Current Baseline
- Target (product intent): deterministic calendar recurrence, explicit conflict handling, and auditable state history.
- Current (implemented): lazy series generation + one sparse occurrence-exceptions table, optimistic UI updates, and replace-in-place exception writes.
- Important deltas to keep visible:
  - There is no append-only chore event history yet.
  - Chore-write conflicts are not surfaced as explicit retryable responses; household lock contention returns `HOUSEHOLD_MUTATION_BUSY`.
- Working rule for contributors: preserve current behavior unless a change is intentional, tested, and documented here.

## Requirements and Issue Integration
- `docs/requirements.md` is the stable source for current behavior, constraints, and known gaps.
- GitHub Issues are the execution backlog and sequencing plan.
- Cross-cutting backlog areas:
  - [#8](https://github.com/kdybicz/sweep-heap/issues/8): integration and end-to-end coverage hardening.
  - [#9](https://github.com/kdybicz/sweep-heap/issues/9): API rate limiting and abuse protections.
  - [#10](https://github.com/kdybicz/sweep-heap/issues/10): stricter DB constraints with a staged migration rollout.
- Workflow rule: when completing an issue tracked here, update this file in the same change if behavior, constraints, or caveats changed.
- The [2026-10-11 review snapshot](reviews/2026-10-11.md) links the reviewed defects and optimizations to their GitHub Issues; current execution status remains in GitHub.

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
- Household setup and editing (name, icon, time zone, member chore-management toggle), with the same toggle available during both create and later edits.
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
  - No active undo UI for done actions; the old toast/countdown work is currently disabled.
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
- Household create/update requires a valid `timeZone`; missing, blank, or invalid values return `400` (`Invalid time zone`) instead of silently coercing to `UTC`.
- Household settings can disable chore add/edit/delete for regular members while still allowing owners/admins to manage chores.
- When an authenticated user has no active household, household-gated APIs return `403` with `error: "Household required"` and `code: "HOUSEHOLD_REQUIRED"`.
- Client fetch flows that lose household context mid-request should branch on `code` and recover to `/household/setup` for `HOUSEHOLD_REQUIRED`, or `/household/select` for `HOUSEHOLD_SELECTION_REQUIRED` and `HOUSEHOLD_NOT_FOUND`.
- Signed-in users without an active household remain in onboarding and should be redirected to household setup until they create or join their first household, unless they need `/household/select` to choose among multiple existing memberships or `/user/delete/confirm` to finish a valid account-deletion link.
- Household-scoped product pages (board, profile, settings, and household management) stay household-gated; the signed-in pre-active-household surface includes auth redirects, invite acceptance, household setup, household selection, and `/user/delete/confirm` when the delete-confirmation token is valid.
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
- Owners can transfer ownership to another active household member; transfer promotes the target to `owner` and demotes the acting owner to `admin` in the same guarded flow.
- Non-owner members can leave the active household through the dedicated self-leave API.
- Owners must transfer ownership before leaving; after transfer, the former owner can leave through the same self-leave flow.
- Self-leave attempts to reconcile `active_household_id` before returning: the sole remaining household is activated, multiple remaining households require `/household/select`, and no remaining households return the user to `/household/setup`.
- If self-leave session healing fails after membership removal, the route still succeeds with a best-effort `nextPath`; later household-scoped API requests with real request headers can finish healing the stale selection, while pages may still resolve fallback state for navigation without persisting new session cookies.
- Admins cannot manage owner memberships or owner-role invites (assign, demote, remove, resend, revoke).

## Invite Rules
- Household invite links require Better Auth `invitationId + secret` and pending-status expiry checks (7 days).
- Invite create/resend delivery is best-effort: APIs return `ok: true` even when SMTP send fails, with `inviteEmailSent: false` in the response.
- Expired pending invitations remain visible as expired on the members page with role-aware resend/revoke controls. Creating a replacement cancels expired pending rows for that normalized household/email and clears their secret hashes. Resending refreshes the same id and role, then rotates the secret and extends validity by seven days.
- Pending-email unique-index failures retry once in a fresh household transaction after rollback; repeated conflicts return `409 USER_ALREADY_INVITED`. Active duplicate invitations retain the existing conflict response.
- Invitation rows and secret hashes are persisted under a household mutation lock; SMTP delivery runs after releasing that lock.
- Accepting invite with active session:
  - Succeeds only when signed-in email matches invite email.
  - Can add the user to another household and switch active context to the accepted household.
  - If membership is created but active-household switching fails, recover through household selection instead of treating the invite as unused.
- Accepting invite without valid matching session:
  - Redirects to magic-link sign-in with callback to `/api/households/invites/complete?invitationId=...&secret=...`.
  - If another account is already signed in, the invite page should offer an explicit sign-out-and-continue path before the magic-link redirect.

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

### Calendar validation and workload limits
- API calendar dates must be real Gregorian dates in years `0001` through `9999`, with complete `YYYY-MM-DD` spelling. Complete ISO calendar timestamps up to 64 characters are also supported; numeric offset hours/minutes must be valid. Reduced-precision, week-date and ordinal-date spellings are rejected.
- Date-only values stay literal. Query/start/end/repeat-cutoff timestamps resolve to the household-local date; occurrence-start identifiers retain UTC normalization. Both source timestamp calendar dates and normalized dates must stay in supported years.
- Explicit GET `start` and `end` are supplied together. Query endpoints are inclusive, ordered, and span at most 31 civil days. Omitted endpoints retain household-local Monday-Sunday defaults and the existing route's `weekOffset` clamp of `-520..520`.
- Create/edit `endDate` is exclusive and must be after `startDate`; occurrence duration is at most 366 civil days. Validate supplied fields before using edit defaults, and validate interpreted defaults, occurrence-relative translations and final stored dates before writes. Missing optional edit dates preserve defaults; malformed supplied values are not silently ignored. Only `seriesEndDate: null` explicitly clears a repeat cutoff.
- Per-request limits are 10,000 rows for each series/exception selection, 10,000 generated day entries and 50,000 recurrence/span iterations. Queries fetch one overflow sentinel row and reject overflow rather than returning a partial selection. These counts apply to work before canceled-occurrence filtering as well as final visible output.
- Edits migrate at most 10,000 exceptions within the same 50,000-step budget as occurrence validation. Existing or mapped exception keys outside supported years are rejected without dropping state. Migration limit/date errors propagate out of the household transaction and become validation responses only after rollback.
- Invalid calendar fields, unsupported spans/ranges and exceeded work limits return HTTP `400` with `{ ok: false, code: "VALIDATION_FAILED", error, fieldErrors }`. Valid dates outside a chore's recurrence remain `409 OCCURRENCE_OUTSIDE_SCHEDULE`. Reconciliation cookies are preserved on errors.
- These are application-boundary limits, not a schema constraint migration. Existing long-span one-offs remain readable within bounded queries and can be completed/canceled without span expansion; schedule edits must produce supported dates/durations. Auditing/backfill before strict database constraints remains tracked in [#10](https://github.com/kdybicz/sweep-heap/issues/10).

### Occurrence generation behavior
- Occurrences are generated lazily from series plus sparse occurrence exceptions.
- The SQL series prefilter excludes non-repeating chores whose exclusive `end_date` is on or before the requested start date. Repeating origins may have older end dates and remain eligible when their recurrence cutoff plus duration can overlap the requested range. One-off spans clipped at either query boundary remain eligible.
- Generation is date-only and timezone-aware (household timezone).
- Recurrence arithmetic uses civil calendar dates represented internally in UTC, not elapsed hours between household-local midnights. Date-only inputs retain their literal date; timestamp inputs first resolve to a date in the household timezone. This avoids persistent hour/phase drift after skipped or repeated midnights.
- Daily, weekly and biweekly generation jumps from the origin to the requested range's duration-adjusted lower bound using 1/7/14-day intervals, then generates the overlapping occurrences. Start validation uses direct membership checks for one-offs and fixed intervals without expanding spans. Month/year generation, validation and ordinal mapping share bounded calendar stepping that restores the original day after each independent clamp.
- Monthly recurrence uses the original day of month, clamping only periods where that day is missing: Jan 31 → Feb 28/29 → Mar 31 → Apr 30. A start on Apr 30 remains a 30th-day pattern, not a last-day-of-month flag. Yearly Feb 29 clamps to Feb 28 in common years and returns to Feb 29 in leap years, including Gregorian century rules.
- `recurrence_anchor_day` optionally carries the inherited calendar day across following-scope splits; null derives the day from `start_date`. Unchanged start/cadence edits (including duration-only changes) preserve that anchor. A changed start date or cadence establishes a new anchor from the resulting start; single edits detach a one-off and do not alter the source pattern.
- Existing legacy month/year exception keys are remapped by calendar ordinal during deployment, preserving kind/status/reason and row metadata. Collisions abort the transaction; unsupported/orphan keys are retained for audit. Cutoffs remain absolute dates. Pre-existing split branches use their own stored start as the original anchor because older storage did not retain lineage. See [calendar recurrence migration](calendar-recurrence-migration.md) for rollout and stale-client identity policy.
- Span expansion visits only the day offsets inside the requested range, including one-off and long overlapping spans; it does not iterate every hidden day of each occurrence.
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
- Chore mutation reads and writes share one household transaction, coordinated with completion and cancellation writers. Failed single/following replacement creation or completion copying leaves the source schedule and exceptions unchanged, and retry remains possible. API permissions are rechecked after lock acquisition; lock contention returns `409 HOUSEHOLD_MUTATION_BUSY`.
- `action=edit` requires `scope=single|following|all`.
- `scope=single` creates a detached one-off chore row and marks the targeted original occurrence canceled.
- `scope=following` is allowed only for repeating chores, truncates the original series at the day before the targeted occurrence, and creates a new future series row.
- If `scope=following` targets the first occurrence in the series, it falls through to the same whole-series result as `scope=all`.
- `scope=all` updates the existing series row in place and keeps the recurrence chain intact.
- Whole-series and following edits migrate all affected completion and cancellation exceptions by occurrence ordinal, starting at the series origin or split occurrence respectively. Cadence changes use the same calendar stepping as board generation. Exceptions without a generated target after shortening the series or converting to a one-off are removed, as are stale off-schedule keys. Earlier exceptions remain on the source branch of a following edit. Old keys are cleared before mapped writes within the household transaction to avoid collisions during date shifts.
- PATCH success fields are top-level, including `choreId`, optional `createdChoreId`, and the source `occurrenceStartDate`. The inline preview survives the save/refetch transition and rebinds single/following edits to the replacement id and occurrence start. Subsequent edits and deletion act on that replacement. If the replacement is outside the visible week, the preview closes after the refreshed list cannot find it.
- Edit actions accept the same chore fields as create; omitted fields fall back to the source series/occurrence defaults.
- Omitted `type` preserves the source chore type for every edit scope; only creation defaults an omitted type to `close_on_done`. Explicit valid type changes are normalized and applied, while supplied invalid or non-string types return validation errors without modifying the occurrence/series.
- Date edits default to absolute series dates for whole-series scope. The inline preview sends `dateBasis=occurrence`; the service translates the selected occurrence's day shift and exclusive duration against the stored series origin. Duration-only changes preserve earlier occurrences. Single/following edits keep their submitted instance dates; first-instance following uses whole-series semantics. Repeat-end dates remain their explicit/stored calendar cutoff.

### UI interaction constraints
- Weekly and Today chore reads expose independent loading/error states and retry controls. Fresh network, server or malformed-response failures show accessible errors rather than empty schedules; week progress stays unavailable until that range has data. Failed background refreshes preserve the same range's last-known chores/progress with an out-of-date notice. A successful retry clears the error and updates data; navigation never borrows another range's data. Auth/household context errors retain their recovery redirects.
- Add-chore and edit/cancel actions remain available for past dates; only the primary done/open action is currently blocked for past-dated occurrences.
- Primary action in the chore preview popover is disabled for past-dated occurrences.
- Household-local Today updates at the next local midnight, using calendar-day arithmetic across DST, and when the window regains focus or the document becomes visible after suspension. Today labels, highlighting, primary-action date guards and date-based queries update without a reload. Resumption refreshes Today and weekly data even on the same local day. The default week follows Today; Previous/Next pins an absolute calendar week across rollover until Today is clicked. Weekly query keys and requests use explicit start/end dates so cached relative offsets cannot drift to another week.
- Repeated midnight advances Today at its first occurrence. Background reads wait for pending completion mutations; settling a completion reconciles weekly and Today data, so a stale refetch cannot overwrite optimistic completion or leave successful writes displayed as open.
- A background update to the selected chore preserves unsaved preview fields, the active editor and its scope choice. Clean fields and status adopt refreshed server data; changing or dismissing the selection resets the editor normally.
- Unsent text retains trailing spaces/newlines during refresh, and keyboard focus stays within the active preview field or scope control. Successful saves normalize text; no-op edits restore the exact stored value. Neither changes the draft while the user is still typing.
- Saved preview text reconciles to canonical storage values: trimmed titles, and trimmed notes capped at 500 characters. A successful save only canonicalizes the submitted draft if it has not been replaced by newer unsent text; saved normalization must not make a field remain falsely dirty during subsequent background updates.
- No-op preview edits restore the exact persisted value. Notes are trimmed before truncation, so a 500-character persisted value may end in whitespace and must not be normalized a second time on blur. A successful type change also reconciles the submitted title, including retries after a failed title-only save.
- In the create/edit modal, the end-date input is inclusive; the UI converts it to the exclusive API/storage `endDate` internally.
- In the create/edit modal, repeating chores default `Repeat ends` to `Never`; selecting `On date` reveals the repeat-end date field and sends `seriesEndDate`.
- On the weekly board, all chores render once in a shared board area over the original day-column backgrounds; single-day chores occupy one day and multi-day chores span across days.
- Chores that start before or end after the visible week use a clipped edge treatment on the continued side (no outer corner radius and no outer vertical border).
- In the sidebar Today list, multi-day chores are collapsed to a single entry per occurrence and may reuse the same compact single-card styling as one-day chores.
- Weekly progress counts unique visible occurrences by `(chore id, occurrence_start_date)`, not their day rows. An occurrence counts once even when clipped at either week boundary; overlapping occurrences of a repeating series remain distinct. Done uses `closed_reason = done`, including logged stay-open chores. Open is total minus done, the percentage is rounded to the nearest integer, and an empty week shows zero percent.
- Single click or keyboard activation on a board chore opens a compact preview popover with title, status, date span, repeat cadence, notes, primary completion/log action, and delete when the viewer can manage chores; clicking the metadata block expands inline editing UI for title/date/repeat fields with single, future, and whole-series scope choices where applicable. When regular members are not allowed to manage chores, add buttons and edit/delete controls are hidden while completion/log actions remain available.

## API Surface (Current Snapshot)
- Failure envelope contract: API routes return `{ ok: false, code: string, error: string }` for handled errors.
- Snapshot includes the app's business APIs plus the auth/session routes that drive sign-in callbacks and sign-out redirects.
- `GET|POST /api/auth/[...auth]`
  - Better Auth handler for magic-link sign-in, callback completion, and session operations.
  - Organization plugin HTTP routes, including reads, are disabled with native `404 Not Found` responses. Household operations use the guarded `/api/households/**` APIs; their services retain server-side Better Auth access.
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
- If sole-remaining-household activation fails, response still succeeds with `nextPath: "/household"`; later page loads can still resolve the sole remaining household via fallback for navigation, but persisted session healing remains best-effort until a later household-scoped API request with real request headers.
  - If the remaining-households lookup itself fails after delete, response still succeeds but falls back to `nextPath: "/household/select"`.
- `GET /api/households/members`
  - Returns active members and pending invites.
- `POST /api/households/members`
  - Creates invite for email.
- `PATCH /api/households/members`
  - Updates member role (owner/admin only).
- `DELETE /api/households/members`
  - Removes member (owner/admin only).
- `POST /api/households/members/leave`
  - Removes the current non-owner member from the active household.
  - Attempts to reconcile active-household session state before returning the next client path.
- If post-leave session healing fails, response still succeeds with a best-effort `nextPath`; later household-scoped API requests with real request headers can finish healing stale session state.
- `POST /api/households/members/owner-transfer`
  - Transfers ownership to another active household member and demotes the acting owner to `admin`.
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
- Returns current user and active memberships.
  - Reconciles stale `active_household_id` when request headers are available.
- `PATCH /api/me`
  - Updates current user name.
- `POST /api/me/delete-request`
  - Creates and emails delete confirmation token (30 min expiry).
- `POST /api/me/delete-confirm`
  - Consumes token and deletes user account.
- `POST /signout`
  - Same-origin sign-out endpoint for switch-account and recovery flows; signs out the current session and redirects to a safe local path.

## Operational and Abuse-Prevention Guardrails
- Current baseline:
  - No dedicated app-level API rate limiting middleware is implemented.
  - Protection mainly relies on authentication checks and route-level validation.
- Planned hardening ([#9](https://github.com/kdybicz/sweep-heap/issues/9)):
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

## Ownership and Deletion Reconciliation (Current)
- Household mutation locks use a separate bounded connection pool so queued locks cannot starve business queries. Connection acquisition is bounded to five seconds, then PostgreSQL lock waits to five seconds before `409 HOUSEHOLD_MUTATION_BUSY`; callbacks retain the lock until they finish.
- Both invite acceptance APIs, including the post-sign-in completion callback, preserve lock contention as `409 HOUSEHOLD_MUTATION_BUSY`. The invitation remains pending and the same link can be retried; completion returns JSON for this conflict instead of an unexpected-error redirect.
- Guarded callback writes share their advisory-lock transaction, so losing the lock connection aborts those writes; further queries are fenced. SDK nested transactions use savepoints.
- Account deletion locks the user row without waiting before reading memberships, then locks all active household memberships before evaluating ownership. New membership FK checks serialize with the user lock. Any busy user or household lock fails immediately with the same code, rolling back token consumption. Token replacement uses a separate user-lock namespace.
- Deleting a user's last household leaves the user in onboarding with no active household; they may create a new household afterward.
- When an active household is deleted or the user's membership in it ends through self-leave, `active_household_id` is cleared or re-resolved when possible before the client continues; if Better Auth session healing fails, later household-scoped API requests with real request headers can finish healing the stale selection, while pages may still resolve fallback state for navigation.
- Multi-household support treats `active_household_id` as the acting context; membership list and ownership checks are evaluated against the targeted household, not inferred by latest membership.

## Code Organization Conventions
- Keep route handlers transport-focused (auth, parsing, response mapping).
- Keep SQL/data access in `src/lib/repositories/*-repository.ts`.
- Keep reusable domain logic in `src/lib/services/*-service.ts`; household member/invite orchestration now lives primarily in `src/lib/services/household-members-service.ts` and chore mutation rules live in `src/lib/services/chore-service.ts`.
- Use the `src/lib/repositories/index.ts` barrel for repositories and specific `src/lib/services/*-service.ts` imports for services. There is no service barrel.

## Testing and Quality Gates
- Prefer focused unit tests for service and route behavior.
- Colocate tests with the source they validate (for example `route.ts` with `route.test.ts`).
- Mock repositories in service tests; avoid DB in unit tests.
- Project default gate for code changes: `make dev-fix` (format, lint fix, tests, typecheck).
- Coverage expansion is tracked in [#8](https://github.com/kdybicz/sweep-heap/issues/8) (Postgres-backed integration tests plus minimal auth/chore/account-deletion E2E flow).
- Live smoke, issue-linked browser/API regressions, and isolated pool contention tests are available through the commands in [E2E testing](e2e-testing.md). These require the local stack and are separate from the default Vitest gate.

## Known Gaps and Implementation Caveats
- Chore concurrency conflicts are not implemented as explicit retryable conflicts; exception upserts remain last-write-wins. Household lock contention has a retryable `409 HOUSEHOLD_MUTATION_BUSY` response.
- No dedicated event/audit history table exists for chore state transitions; only latest exception state is stored.
- `closed_reason = schedule_end` lifecycle is not currently persisted by background process; closure is mostly represented by derived listing behavior.
- Cancel actions are available from the board chore preview popover for single-occurrence, this-and-following, and whole-series cancellation depending on the targeted recurrence.
- Completion undo UI is currently disabled; `UndoToastStack` is not wired into the board. The API still accepts `action=set` with `status=open` and removes the stored completion exception.
- Some data invariants are enforced at app-validation level rather than strict DB constraints; staged hardening is tracked in [#10](https://github.com/kdybicz/sweep-heap/issues/10).

## Decision Notes for Future Work
- If recurrence behavior is changed, update both `src/lib/occurrences.ts` and the overlap prefilters in `src/lib/repositories/chore-repository.ts`, then align tests plus API/UI assumptions.
- If auditability becomes mandatory, introduce append-only event storage instead of relying on exception row replacement.
