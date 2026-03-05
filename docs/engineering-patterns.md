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

Rules for `secure`:

- If `SMTP_SECURE` is set (`true`/`false`), it overrides auto-detection.
- If unset, `secure` defaults to `true` for port `465`, otherwise `false`.

## 3) API Error Contract

Return a consistent JSON envelope for failures:

- `{ ok: false, error: string }`

Use status codes consistently:

- `401`: no authenticated session.
- `400`: malformed request or invalid user/session payload.
- `403`: authenticated but not allowed (including `Household required` and role-based `Forbidden`).
- `404`: requested resource is missing (for example member/invite/chore not found).
- `409`: valid request conflicts with business rules.

Important contract:

- When a user is authenticated but has no active household, return `403` with `error: "Household required"`.

## 4) Page-Level Access Guards

Keep page-level access rules aligned with API permissions:

- Server-rendered pages for privileged actions must enforce the same role checks as the API they submit to.
- For household admin-only flows (for example `/household/edit` with `PATCH /api/households`), redirect non-admin members before rendering the edit form.

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
