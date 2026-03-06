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
- Delete-account request is email-required: if SMTP send fails, return `500` with `{ ok: false, error: "Failed to send confirmation email" }`.

Rules for `secure`:

- If `SMTP_SECURE` is set (`true`/`false`), it overrides auto-detection.
- If unset, `secure` defaults to `true` for port `465`, otherwise `false`.
- Treat blank/invalid `SMTP_PORT` values as unset and fall back to `587`.

## 3) API Error Contract

Return a consistent JSON envelope for failures:

- `{ ok: false, error: string }`
- Keep route handlers wrapped in top-level `try/catch` so unexpected throws still return the same envelope.

Use status codes consistently:

- `401`: no authenticated session.
- `400`: malformed request or invalid user/session payload.
- `403`: authenticated but not allowed (including `Household required` and role-based `Forbidden`).
- `404`: requested resource is missing (for example member/invite/chore not found).
- `409`: valid request conflicts with business rules (for example owner-protection constraints or expired undo).

Body parsing rule:

- `parseJsonObjectBody()` should return `null` for parse failures and valid non-object JSON (arrays/primitives), so routes can consistently return `400` with `Invalid JSON body` for non-object payloads.
- For authenticated API routes that require numeric user ids, use `getSessionContext()` from `src/lib/session-context.ts` to keep auth/status handling consistent.
- Prefer Zod schema validation for parsed request payloads to avoid ad-hoc `typeof` checks and keep error messaging centralized in shared validators.

Important contract:

- When a user is authenticated but has no active household, return `403` with `error: "Household required"`.

## 4) Page-Level Access Guards

Keep page-level access rules aligned with API permissions:

- Server-rendered pages for privileged actions must enforce the same role checks as the API they submit to.
- For household owner/admin flows (for example `/household/edit` with `PATCH /api/households`), redirect non-privileged members before rendering the edit form.

## 5) Recurrence and Occurrence Generation

In `src/lib/occurrences.ts`:

- Non-repeating (`repeatRule === "none"`) chores must include any day where the chore span overlaps the query range.
- Recurrence cursor loops must guard against non-advancing values (`nextCursor.equals(cursor)`) to avoid hangs.
- Keep date math timezone-aware and day-based (`Luxon`, `startOf("day")`, ISO date keys).

## 6) Testing Standards for Contracts

When you change behavior in these areas, update tests in the same PR:

- API contract/status behavior (`src/lib/api-*.test.ts`).
- Recurrence and date edge cases (`src/lib/occurrences.test.ts`, date-utils tests).
- Shared config helpers (`src/lib/smtp.test.ts`).

Prefer adding regression tests for bugs that were fixed.

## 7) Maintenance Rule

If a recurring surprise gets fixed and becomes a standard:

1. Document the standard here.
2. Remove or shorten the matching note in `AGENTS.md`.

## 8) Members API Consistency

For household member/invite role-management routes:

- Reject self-removal requests (`targetUserId === session user id`) with `400`.
- Keep UI affordances aligned with API behavior for self-role/self-removal restrictions.
- Enforce owner-role protections at the API boundary (`403`): non-owners cannot manage owner memberships or owner-role invites.
- Translate Better Auth business-rule conflicts (for example last-owner) to consistent `409` responses.

## 9) Chore Undo Contract

For `PATCH /api/chores` with `action: "undo"`:

- Undo must be enforced server-side using `undo_until` (not only by UI toast timing).
- Return `409` with a conflict error when the undo window is no longer active.
- For `action: "set"` and `action: "undo"`, validate that `occurrenceDate` is a generated series occurrence day for the chore and return `409` when it is outside schedule.
- Keep undo timing centralized via `CHORE_UNDO_WINDOW_SECONDS`/`CHORE_UNDO_WINDOW_MS` (`src/lib/chore-undo.ts`) and consume those constants in API service logic and UI countdown rendering.

## 10) Invite Deduplication Contract

For household invite creation:

- Keep email normalization (`trim().toLowerCase()`) before persistence.
- Enforce one pending invite per `(household, email)` with a partial unique DB index and handle race conflicts by returning the already-pending invite response.

## 11) Build vs Buy Recommendation Standard

When proposing implementation approaches (in issues, plans, or PR summaries):

- Default to proven, well-maintained libraries/tools before proposing a custom in-house implementation.
- For non-trivial decisions, provide a concise tradeoff comparison with both options:
  - Ready-to-import library/tool: pros and cons (reliability, maturity, ecosystem fit, integration effort, lock-in risk).
  - In-house solution: pros and cons (control, customization, delivery time, maintenance burden, long-term risk).
- End with a clear recommendation and rationale; choose in-house only when constraints require it (for example domain-specific requirements, licensing/compliance limits, or lack of a mature ecosystem fit).
