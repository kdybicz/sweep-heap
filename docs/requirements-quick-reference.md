# Chores - Quick Reference

Use this page for day-to-day implementation decisions. For full detail, use `docs/requirements.md`.

## Current Product Surface
- Auth: magic-link sign in/out.
- Household: create, edit, role-aware membership.
- Members: invite, resend, revoke, promote/demote, remove, leave, transfer ownership.
- Board: weekly chores view, today panel, add chore, mark done, edit occurrence/following/series, cancel.
- Settings: profile edit, appearance theme, account deletion flow.

## Core Rules

### Household and roles
- Any signed-in user can create a household, including users who already belong to another active household.
- Active household comes from session `active_household_id`, with one-household bootstrap fallback when the session selection is missing or stale.
- Owner/admin-only: edit household, revoke invites, change roles, remove members.
- Owner-only: delete household, transfer ownership, and manage owner-role memberships/invites.
- Non-owner members can leave the active household; owners transfer first, then leave as non-owners.
- Household create/edit validates time zone; invalid values return `400` (`Invalid time zone`).
- Household time zone is required in storage and household lookups should fail loudly rather than silently defaulting when a household record is missing.
- `POST /api/households` rolls back the new household if session activation fails and restores the prior active household when one existed; if rollback cannot be completed, it returns `500` with `Failed to activate new household and roll back create`.
- API failures include `{ ok: false, code, error }`; control flow should branch on `code`.
- Household-gated APIs use `code: "HOUSEHOLD_REQUIRED"` for missing active-household access; clients should branch on `code`, not error message text.
- Household selection uses session `active_household_id` as the primary context; when multiple memberships exist without an active selection, redirect to `/household/select` or handle `HOUSEHOLD_SELECTION_REQUIRED`.
- Client fetch flows that lose household context mid-request should recover by redirecting to `/household/setup` for `HOUSEHOLD_REQUIRED`, or `/household/select` for `HOUSEHOLD_SELECTION_REQUIRED` and `HOUSEHOLD_NOT_FOUND`.
- `/api/me` also reconciles stale `active_household_id` when request headers are available.
- Signed-in users without an active household should stay in the auth/onboarding flow until setup or invite acceptance completes.
- Settings, profile, and board pages stay behind active-household access.
- `/` and `/auth` should bounce signed-in users into `/household`, `/household/select`, or `/household/setup` based on context.
- Plain magic-link sign-in should return through the same onboarding redirect entry point; invite sign-in keeps the invite-complete callback.
- Users cannot change their own role from the members endpoint.
- Household administrators cannot remove themselves from the members endpoint.
- `POST /api/households/members/leave` attempts to reconcile stale `active_household_id` after self-leave; if Better Auth session healing fails after membership removal, the route still returns a best-effort `nextPath` and later household-scoped requests can finish healing.
- Admins cannot manage owner memberships or owner-role invites (assign, demote, remove, resend, revoke).

### Invites
- Invite validity is `invitationId + secret` + pending-status expiry window (7 days).
- Invite create/resend is best-effort for SMTP delivery; check `inviteEmailSent` in success responses.
- Signed-in acceptance requires session email to match invited email.
- Accepting an invite can add a user to an additional household and switches active context to the accepted household.
- If no matching session, API returns a sign-in redirect with callback to invite completion.

### Chores
- Series fields: `title`, `type`, `startDate`, `endDate`, `repeatRule`, optional `seriesEndDate`, `notes`.
- API/storage `endDate` is exclusive (next day for an all-day single occurrence).
- The create/edit modal shows an inclusive end date and converts it to the exclusive API/storage value on submit.
- The create/edit modal defaults repeating chores to `Repeat ends = Never`; `On date` reveals the repeat-end date picker.
- Types: `close_on_done`, `stay_open`.
- Repeat rules: `none`, `day`, `week`, `biweek`, `month`, `year`.
- Create validation enforces required fields, date ordering, and repeat/end compatibility.
- Occurrences are generated lazily from series (date-only, household timezone) and merged with sparse occurrence exceptions keyed by `occurrenceStartDate`.

### Done and cancel
- `close_on_done`: done sets `status=closed`, `closed_reason=done`.
- `stay_open`: done sets `status=open`, `closed_reason=done`.
- `action=set` must target a valid generated occurrence start date for the chore series.
- Creating chores and edit/cancel actions are allowed for past dates; only the primary done/open action is currently blocked for past occurrences.
- `action=cancel|edit` requires `scope=single|following|all`.
- `scope=following` is valid only for repeating chores; if the targeted occurrence is the first series instance, it falls through to the same whole-series result as `all`.
- `scope=single` creates occurrence-only exceptions or one-off edits.
- `scope=following` splits a repeating series into a new future branch.
- `scope=all` updates or cancels the entire series definition.
- Mutation payloads use `occurrenceStartDate`.
- Chore list rows include `occurrence_date` (calendar day) and `occurrence_start_date` (instance identity).
- On the weekly board, all chores render once in a shared board area over the original day-column backgrounds; single-day chores occupy one day and multi-day chores span across days.
- Chores clipped by the current week use a clipped edge treatment at the left and/or right edge (no outer corner radius and no outer vertical border).
- The sidebar Today list collapses multi-day chores to one entry per occurrence.
- Single click opens a compact chore preview popover; clicking the metadata block expands local inline editing UI in the popover, and double click opens the full chore details modal.

## API Snapshot
- `GET /api/health`
- `GET|POST|PATCH|DELETE /api/households`
- `POST /api/households/active`
- `GET|POST|PATCH|DELETE /api/households/members`
- `POST /api/households/members/leave`
- `POST /api/households/members/owner-transfer`
- `POST|DELETE /api/households/members/invites/[inviteId]`
- `POST /api/households/invites/accept`
- `GET /api/households/invites/complete`
- `GET|PATCH /api/chores`
- `GET|PATCH /api/me`
- `POST /api/me/delete-request`
- `POST /api/me/delete-confirm`
- Account deletion is blocked while the user still owns a household with other active members.
- Delete-request email delivery is required; SMTP failures return `500`.
- Household deletion still returns to `/household` if reactivating the sole remaining household fails; one-household bootstrap fallback covers the stale-session gap, with best-effort healing on a later household-scoped API request.
- If post-delete remaining-household inspection fails entirely, household deletion falls back to `/household/select`.

## Key File Map
- Routes: `src/app/api/**/route.ts`
- Tests (colocated): `src/**/*.test.ts`, `src/**/*.test.tsx`
- Repositories (SQL): `src/lib/repositories/*-repository.ts`
- Services: `src/lib/services/*-service.ts`
- Recurrence generation: `src/lib/occurrences.ts`
- Chore create validation: `src/lib/chore-validation.ts`
- Board state/actions: `src/app/household/board/*`
- Schema and migrations: `src/lib/drizzle/schema.ts`, `drizzle/**`

## Known Gaps (Do Not Forget)
- No append-only chore event log yet (only latest exception state).
- Concurrency conflicts are not exposed as explicit retryable responses.
- Month/year recurrence edge cases can drift from strict start-date anchoring.
- Board UI exposes cancel actions from the chore details modal for single-occurrence, this-and-following, and whole-series cancellation.

## Backlog Links
- Active execution backlog: `docs/todo.md`.
- Stable IDs in use: `TODO-1`, `TODO-2`, `TODO-3`.

## Change Checklist
- Keep route handlers thin and transport-focused.
- Keep SQL in repositories; keep domain rules in services.
- For household member/invite routes, keep branching and policy checks in services rather than route handlers.
- Add or update focused tests when behavior changes.
- If behavior intentionally changes, update both requirements docs.
