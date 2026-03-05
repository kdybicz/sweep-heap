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
- Admin-only: edit household, revoke invites, change roles, remove members.
- Last admin cannot be demoted or removed.
- Admin cannot change their own role from the members endpoint.
- Admin cannot remove themselves from the members endpoint.

### Invites
- Invite validity is `identifier + tokenHash` and expiry window (7 days).
- Signed-in acceptance requires session email to match invited email.
- If no matching session, API returns redirect for magic-link verification handoff.

### Chores
- Series fields: `title`, `type`, `startDate`, `endDate`, `repeatRule`, optional `seriesEndDate`, `notes`.
- Types: `close_on_done`, `stay_open`.
- Repeat rules: `none`, `day`, `week`, `biweek`, `month`, `year`.
- Create validation enforces required fields, date ordering, non-past dates, and repeat/end compatibility.
- Occurrences are generated lazily from series (date-only, household timezone) and merged with overrides.

### Done and undo
- `close_on_done`: done sets `status=closed`, `closed_reason=done`.
- `stay_open`: done sets `status=open`, `closed_reason=done`.
- Undo window is 5 seconds.
- `action=set` and `action=undo` must target a valid generated occurrence date for the chore series.
- Undo is API-enforced against `undo_until` and returns conflict after expiry.
- Undo deletes the occurrence override row.

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

## Key File Map
- Routes: `src/app/api/**/route.ts`
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
- Skip and Snooze buttons are UI placeholders (no backend action).

## Backlog Links
- Active execution backlog: `docs/todo.md`.
- Stable IDs in use: `TODO-1`, `TODO-2`, `TODO-3`.

## Change Checklist
- Keep route handlers thin and transport-focused.
- Keep SQL in repositories; keep domain rules in services.
- For legacy household member/invite routes, extract touched domain logic into services rather than adding more route-level branching.
- Add or update focused tests when behavior changes.
- If behavior intentionally changes, update both requirements docs.
