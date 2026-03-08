# Chores - Quick Reference

Use this page for day-to-day implementation decisions. For full detail, use `docs/requirements.md`.

## Current Product Surface
- Auth: magic-link sign in/out.
- Household: create, edit, role-aware membership.
- Members: invite, resend, revoke, promote/demote, remove.
- Board: weekly chores view, today panel, add chore, mark done, undo.
- Settings: profile edit, appearance theme, account deletion flow.

## Core Rules

### Household and roles
- User can create a household only if they have no active membership.
- Active household is latest active membership by `joined_at`.
- Owner/admin-only: edit household, revoke invites, change roles, remove members.
- Household create/edit validates time zone; invalid values return `400` (`Invalid time zone`).
- API failures include `{ ok: false, code, error }`; control flow should branch on `code`.
- Household-gated APIs use `code: "HOUSEHOLD_REQUIRED"` for missing active-household access; clients should branch on `code`, not error message text.
- Signed-in users without an active household should stay in the auth/onboarding flow until setup or invite acceptance completes.
- Settings, profile, and board pages stay behind active-household access.
- `/` and `/auth` should bounce signed-in users into `/household` or `/household/setup`.
- Plain magic-link sign-in should return through the same onboarding redirect entry point; invite sign-in keeps the invite-complete callback.
- Users cannot change their own role from the members endpoint.
- Household administrators cannot remove themselves from the members endpoint.
- Admins cannot manage owner memberships or owner-role invites (assign, demote, remove, resend, revoke).

### Invites
- Invite validity is `invitationId + secret` + pending-status expiry window (7 days).
- Invite create/resend is best-effort for SMTP delivery; check `inviteEmailSent` in success responses.
- Signed-in acceptance requires session email to match invited email.
- If no matching session, API returns a sign-in redirect with callback to invite completion.

### Chores
- Series fields: `title`, `type`, `startDate`, `endDate`, `repeatRule`, optional `seriesEndDate`, `notes`.
- `endDate` is exclusive (next day for an all-day single occurrence).
- Types: `close_on_done`, `stay_open`.
- Repeat rules: `none`, `day`, `week`, `biweek`, `month`, `year`.
- Create validation enforces required fields, date ordering, non-past dates, and repeat/end compatibility.
- Occurrences are generated lazily from series (date-only, household timezone) and merged with occurrence-start keyed overrides/exclusions.

### Done and undo
- `close_on_done`: done sets `status=closed`, `closed_reason=done`.
- `stay_open`: done sets `status=open`, `closed_reason=done`.
- Undo window is 5 seconds.
- `action=set` and `action=undo` must target a valid generated occurrence start date for the chore series.
- Undo is API-enforced against `undo_until` and returns conflict after expiry.
- Undo deletes the occurrence override row.
- `action=cancel` supports `cancelScope=single|following` for one-instance cancel and this-and-following cancel.
- `cancelScope=following` is valid only for repeating chores.
- Mutation payloads use `occurrenceStartDate`.
- Chore list rows include `occurrence_date` (calendar day) and `occurrence_start_date` (instance identity).

## API Snapshot
- `GET /api/health`
- `GET|POST|PATCH /api/households`
- `GET|POST|PATCH|DELETE /api/households/members`
- `POST|DELETE /api/households/members/invites/[inviteId]`
- `POST /api/households/invites/accept`
- `GET /api/households/invites/complete`
- `GET|PATCH /api/chores`
- `GET|PATCH /api/me`
- `POST /api/me/delete-request`
- `POST /api/me/delete-confirm`
- Delete-request email delivery is required; SMTP failures return `500`.

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
- No append-only chore event log yet (only latest override state).
- Concurrency conflicts are not exposed as explicit retryable responses.
- Month/year recurrence edge cases can drift from strict start-date anchoring.
- Board UI does not yet expose first-class cancel/snooze actions (cancel is currently API-only).

## Backlog Links
- Active execution backlog: `docs/todo.md`.
- Stable IDs in use: `TODO-1`, `TODO-2`, `TODO-3`.

## Change Checklist
- Keep route handlers thin and transport-focused.
- Keep SQL in repositories; keep domain rules in services.
- For household member/invite routes, keep branching and policy checks in services rather than route handlers.
- Add or update focused tests when behavior changes.
- If behavior intentionally changes, update both requirements docs.
