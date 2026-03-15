# Engineering Patterns

This document is the canonical source for implementation standards in this repo.

- Put durable coding patterns here.
- Keep `AGENTS.md` focused on surprises, tooling pitfalls, and workflow gotchas.

## 1) Environment Loading Patterns

Use the right env loader by runtime:

- Next.js runtime code: rely on Next env loading.
- Node `.mjs` scripts: use `@next/env` with interop-safe import handling.
- `drizzle.config.ts`: keep `import { loadEnvConfig } from "@next/env"` unless tooling proves otherwise.

For agent/container flows:

- Use shared `make` targets for both humans and agents.
- When `AGENT` is set, `Makefile` exports container-safe overrides (`DATABASE_URL`, `AUTH_URL`, `SMTP_HOST`).
- Keep `.env.local` as the canonical host-dev values and avoid parsing dotenv files in Make (`include .env`) because Make syntax is not full dotenv syntax.

## 2) SMTP and Email Transport

All email flows should use centralized SMTP settings from `src/lib/smtp.ts`:

- Call `getSmtpSettings()` for transport config.
- Build nodemailer transport with `host`, `port`, `secure`, and `auth` from those settings.
- Treat missing host/from as configuration errors where email is required.

Delivery semantics:

- Household invite create/resend is best-effort: persist/update invite state first, then attempt SMTP send, and return `ok: true` with `inviteEmailSent` to report delivery outcome.
- Delete-account request is email-required: if SMTP send fails, return `500` with `{ ok: false, code: "INTERNAL_SERVER_ERROR", error: "Failed to send confirmation email" }`.

Rules for `secure`:

- If `SMTP_SECURE` is set (`true`/`false`), it overrides auto-detection.
- If unset, `secure` defaults to `true` for port `465`, otherwise `false`.
- Treat blank/invalid `SMTP_PORT` values as unset and fall back to `587`.

## 3) API Error Contract

Return a consistent JSON envelope for failures:

- `{ ok: false, code: string, error: string }`
- Include a stable machine-readable `code` field on every API failure response (for example `code: "HOUSEHOLD_REQUIRED"`) so UI behavior is never tied to user-facing message text.
- Client and server control flow must branch on `code` (and optional HTTP status), not on `error` message text.
- Keep route handlers wrapped in top-level `try/catch` so unexpected throws still return the same envelope.

Use status codes consistently:

- `401`: no authenticated session.
- `400`: malformed request or invalid user/session payload.
- `403`: authenticated but not allowed (including `Household required` and role-based `Forbidden`).
- `404`: requested resource is missing (for example member/invite/chore not found).
- `409`: valid request conflicts with business rules or required context selection (for example `HOUSEHOLD_SELECTION_REQUIRED`, owner-protection constraints, or occurrence state conflicts).

Body parsing rule:

- `parseJsonObjectBody()` should return `null` for parse failures and valid non-object JSON (arrays/primitives), so routes can consistently return `400` with `Invalid JSON body` for non-object payloads.
- For authenticated API routes that require numeric user ids, use `getSessionContext()` from `src/lib/session-context.ts` to keep auth/status handling consistent.
- Prefer Zod schema validation for parsed request payloads to avoid ad-hoc `typeof` checks and keep error messaging centralized in shared validators.
- Route handlers using `requireApiSessionHouseholdResolution()`, `requireApiHousehold()`, or `requireApiHouseholdAdmin()` should pass `request.headers` so active-household reconciliation can emit `Set-Cookie` headers when healing stale session state.
- When forwarding Better Auth `asResponse: true` cookies between services and route handlers, use `src/lib/auth-response.ts` helpers so `Set-Cookie` propagation stays consistent.

Important contract:

- When a user is authenticated but has no active household, return `403` with `error: "Household required"` and `code: "HOUSEHOLD_REQUIRED"`.

## 4) Page-Level Access Guards

Keep page-level access rules aligned with API permissions:

- Server-rendered pages for privileged actions must enforce the same role checks as the API they submit to.
- Household-scoped product pages (board, profile, settings, household management) should require an active household before rendering.
- The signed-in pre-active-household surface includes auth redirects, invite acceptance, and household selection when multiple memberships exist without a valid active selection; household setup is also a signed-in create-household entry point for existing members.
- Public entry points such as `/` and `/auth` should redirect signed-in users to `/household`, `/household/select`, or `/household/setup` rather than leaving them on public pages.
- For household owner/admin flows (for example `/household/edit` with `PATCH /api/households`), redirect non-privileged members before rendering the edit form.

## 5) Recurrence and Occurrence Generation

In `src/lib/occurrences.ts`:

- Non-repeating (`repeatRule === "none"`) chores must include any day where the chore span overlaps the query range.
- Treat API/storage `endDate` as exclusive for span math; convert from the inclusive create/edit form input at the UI boundary.
- Recurrence cursor loops must guard against non-advancing values (`nextCursor.equals(cursor)`) to avoid hangs.
- Keep date math timezone-aware and day-based (`Luxon`, `startOf("day")`, ISO date keys).
- `generateOccurrenceDayKeys()` returns the visible day keys in range, while `generateOccurrenceDayEntries()` returns one row per visible day in a span tied back to its occurrence start date.
- Keep `src/lib/occurrences.ts` overlap behavior aligned with the SQL prefilters in `src/lib/repositories/chore-repository.ts`; changing only one side can silently drop or over-include chores.

## 6) Testing Standards for Contracts

Test placement standard:

- Colocate tests with the implementation file they cover.
- Route handler contract tests live next to route files (`src/app/api/**/route.test.ts`).

When you change behavior in these areas, update tests in the same PR:

- API contract/status behavior (route handler tests).
- Recurrence and date edge cases (`src/lib/occurrences.test.ts`, date-utils tests).
- Shared config helpers (`src/lib/smtp.test.ts`).
- Vitest runs in `environment: "node"` for both `*.test.ts` and `*.test.tsx`; do not assume browser DOM APIs unless a test sets them up explicitly.

Prefer adding regression tests for bugs that were fixed.

## 7) Maintenance Rule

Documentation and implementation should stay in sync:

- Keep documentation, names, comments, and examples aligned with current behavior.
- Make non-obvious assumptions and edge cases explicit in code or docs where future maintainers are likely to look.
- When inconsistencies are found, fix small safe issues promptly; if a larger issue cannot be resolved in the current change, document the affected files, the risk, and the recommended follow-up.

## 8) Keeping Standards Current

If a recurring surprise gets fixed and becomes a standard:

1. Document the standard here.
2. Remove or shorten the matching note in `AGENTS.md`.

## 9) Members API Consistency

For household member/invite role-management routes:

- Reject self-removal requests (`targetUserId === session user id`) with `400`.
- Keep UI affordances aligned with API behavior for self-role/self-removal restrictions.
- Enforce owner-role protections at the API boundary (`403`): non-owners cannot manage owner memberships or owner-role invites.
- Translate Better Auth business-rule conflicts (for example last-owner) to consistent `409` responses.

## 10) Chore Mutation Contract

For `PATCH /api/chores`:

- Support `action: "create" | "set" | "cancel" | "edit"`.
- For `action: "set"`, validate that `occurrenceStartDate` is a generated series occurrence start date for the chore and return `409` when it is outside schedule.
- For `action: "cancel" | "edit"`, require `scope: "single" | "following" | "all"`.
- Scope semantics follow Google Calendar: `single` affects only the selected occurrence, `following` affects the selected occurrence plus later ones, and `all` affects the full series definition.
- Scope resolution is based on the selected occurrence's position in the series; do not use household-local `today` as a cutoff.
- For `scope: "single"`, cancel upserts a `kind = canceled` exception and edit creates a detached one-off chore while canceling the original occurrence.
- For `scope: "following"`, require a repeating chore (`repeatRule !== "none"`) and truncate the original series before the targeted occurrence unless that occurrence is the first series instance; first-instance `following` falls through to whole-series behavior.
- For `scope: "all"`, cancel marks the source series row canceled and edit updates the current series row in place using the submitted fields/defaults.
- Keep `UndoToastStack` and related undo UI pieces isolated so they can be reconnected later without shaping the active mutation contract.

## 11) Invite Deduplication Contract

For household invite creation:

- Keep email normalization (`trim().toLowerCase()`) before persistence.
- Enforce one pending invite per `(household, email)` with a partial unique DB index and handle race conflicts by returning the already-pending invite response.

## 12) Invite Acceptance Handoff

For household invite acceptance:

- Treat household membership as multi-household capable; invite acceptance should not reject users solely because they already belong to another household.
- Keep the session-email check strict: only the invited email can accept the invite.
- When the wrong account is signed in, prefer an explicit sign-out-and-continue handoff that preserves the invite callback instead of weakening the default signed-in redirect behavior on `/auth`.
- If membership is created but post-accept active-household switching fails, recover to a household selection/setup path instead of bouncing back to an already-consumed invite.
- For local redirect targets, use `src/lib/safe-local-path.ts` instead of ad-hoc checks. Decode once when validating user-entered callback params (for example `/auth`), but keep nested redirect targets encoded when validating values already parsed from `URLSearchParams` (for example `/signout?redirectTo=...`) so inner callback query strings are not truncated. Reject network-path variants using both `/` and `\` prefixes; backslash forms like `/\\evil.com` are not safe local paths.

## 13) Build vs Buy Recommendation Standard

When proposing implementation approaches (in issues, plans, or PR summaries):

- Default to proven, well-maintained libraries/tools before proposing a custom in-house implementation.
- For non-trivial decisions, provide a concise tradeoff comparison with both options:
  - Ready-to-import library/tool: pros and cons (reliability, maturity, ecosystem fit, integration effort, lock-in risk).
  - In-house solution: pros and cons (control, customization, delivery time, maintenance burden, long-term risk).
- End with a clear recommendation and rationale; choose in-house only when constraints require it (for example domain-specific requirements, licensing/compliance limits, or lack of a mature ecosystem fit).

## 14) PoC Database Compatibility Policy

Current project posture:

- This repository is a Proof of Concept (PoC) with no production data yet.
- We do not require backward-compatible schema migrations across historical local/dev data.
- It is acceptable for schema changes to break old local data, as long as the current version works correctly end-to-end.
- When schema-breaking changes are introduced, prefer clear reset/seed instructions in the same PR so teammates can get back to a working state quickly.
