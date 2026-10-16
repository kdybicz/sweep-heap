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

Template standard:

- Use shared React Email templates under `src/lib/email/templates/*` instead of hand-built HTML strings.
- Reuse the shared layout/theme in `src/lib/email/EmailLayout.tsx` so transactional emails keep one visual system and one maintenance surface.
- Render both `html` and `text` from the same template source via `@react-email/render` to reduce copy drift between MIME parts.
- Keep each previewable template file default-exported and attach `PreviewProps` so `make email-dev` can render it locally.

Rules for `secure`:

- If `SMTP_SECURE` is set (`true`/`false`), it overrides auto-detection.
- If unset, `secure` defaults to `true` for port `465`, otherwise `false`.
- Treat blank/invalid `SMTP_PORT` values as unset and fall back to `587`.

## 3) API Error Contract

### Organization HTTP boundary

Better Auth's organization plugin is server-only. `src/auth.ts` derives `disabledPaths` from the
configured plugin's HTTP endpoints, including reads, so the catch-all auth handler returns native
`404 Not Found` responses for those routes before dispatch. Server-side `auth.api` organization
methods remain available to the guarded household routes and services. Browser code must use
`/api/households/**` rather than `authClient.organization`.

This uses Better Auth's supported HTTP-only control rather than duplicating household policies in
plugin hooks. Hooks would retain a second public API with separate validation, invitation-secret,
ownership-lock and session-reconciliation rules to maintain. New organization plugin endpoints
are included automatically in the disabled path list.

Return a consistent JSON envelope for business API failures. Better Auth's catch-all handler retains
the provider's response formats, including native text `404` responses for disabled routes:

- `{ ok: false, code: string, error: string }`
- Chore date/range/duration/work failures use `400 VALIDATION_FAILED` plus `fieldErrors`. Shared format/year normalization and all numeric limits live in `src/lib/chore-date-validation.ts`. Reject malformed fields before chore reads; normalize timestamp fields with household context before checking civil-day ordering/width. Explicit read bounds are a pair, and supplied edit dates must not fall through to defaults when invalid.
- Include a stable machine-readable `code` field on every business API failure response (for example `code: "HOUSEHOLD_REQUIRED"`) so UI behavior is never tied to user-facing message text.
- Client and server control flow must branch on `code` (and optional HTTP status), not on `error` message text.
- Board query models expose loading, fetching, data presence and non-context errors separately. Render empty states only after successful reads; keep same-key cached chores on refresh failure and label them stale. Scope retry invalidation to the exact week/Today key. Treat `HouseholdContextRedirectError` as recovery navigation, not a retryable board error.
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
- Low-level access helpers such as `src/lib/api-access.ts` and `src/lib/page-access.ts` should import the specific service modules they need instead of the `src/lib/services/index.ts` barrel, so auth/db-heavy service modules are not pulled in transitively during tests or server startup.
- When forwarding Better Auth `asResponse: true` cookies between services and route handlers, use `src/lib/auth-response.ts` helpers so `Set-Cookie` propagation stays consistent.
- Chore PATCH success JSON is flat: `{ ok: true, choreId, createdChoreId?, occurrenceStartDate?, ... }`. Share `ChoreMutationResponse` from `src/lib/chore-mutation-response.ts` across route and client. The service's internal `data` wrapper does not appear in HTTP JSON; `occurrenceStartDate` identifies the source occurrence, while date edits use the submitted start date for the replacement.

Important contract:

- When a user is authenticated but has no active household, return `403` with `error: "Household required"` and `code: "HOUSEHOLD_REQUIRED"`.

## 4) Page-Level Access Guards

Keep page-level access rules aligned with API permissions:

- Server-rendered pages for privileged actions must enforce the same role checks as the API they submit to.
- Household-scoped product pages (board, profile, settings, household management) should require an active household before rendering.
- The signed-in pre-active-household surface includes auth redirects, invite acceptance, `/user/delete/confirm` when its token is valid, and household selection when multiple memberships exist without a valid active selection; household setup is also a signed-in create-household entry point for existing members.
- Public entry points such as `/` and `/auth` should redirect signed-in users to `/household`, `/household/select`, or `/household/setup` rather than leaving them on public pages.
- Standalone flow pages should prefer explicit escape links to the safest known destination instead of relying on browser history; hide that escape when onboarding or recovery truly has no valid destination yet.
- For household owner/admin flows (for example `/household/edit` with `PATCH /api/households`), redirect non-privileged members before rendering the edit form.

## 5) Recurrence and Occurrence Generation

In `src/lib/occurrences.ts`:

- Non-repeating (`repeatRule === "none"`) chores must include any day where the chore span overlaps the query range.
- Treat API/storage `endDate` as exclusive for span math; convert from the inclusive create/edit form input at the UI boundary with the shared helpers in `src/lib/chore-date-range.ts`.
- Recurrence cursor loops must guard against non-advancing values (`nextCursor.equals(cursor)`) to avoid hangs.
- API recurrence work receives a request-local `OccurrenceGenerationBudget`, shared across selected series or edit validation/migration. Charge seek/iteration/span work and materialized entries, including candidates hidden by cancellation. List and migration queries fetch at most their row limit plus one sentinel; reject excess instead of silently truncating.
- Start validation is membership, not span expansion: compare one-off identity or fixed-interval modulo directly, and step calendar rules only within the budget. Legacy large spans must not allocate arrays merely to complete/cancel their start.
- Convert thrown generation/migration date or work errors to API failures outside `withHouseholdMutationLock()`, after rollback. A migration can fail after source truncation/update or replacement insertion. Validate every mapped exception key against supported years before deleting old keys or upserting new ones.
- Stop ordinal mapping at the final requested key and compare cursor bounds as dates, not ISO strings: expanded years above 9999 sort before supported four-digit date keys.
- Keep date math timezone-aware and day-based (`Luxon`, `startOf("day")`, ISO date keys).
- Inside the recurrence generator, use UTC as a civil-date coordinate system. Keep date-only labels literal and resolve timestamp inputs to their household-local date before clearing time-of-day. Do not seek with elapsed milliseconds in a DST-observing zone or carry a normalized 1 AM midnight into later occurrences.
- Fixed intervals use `max(0, floor((earliestRelevantStart - origin) / intervalDays))` to find the first cursor, with `earliestRelevantStart = max(origin, rangeStart) - (durationDays - 1)` and calendar-day differences. Preserve the origin's phase, inclusive start cutoffs, and overlapping spans. Month/year rules still step through their clamped sequence.
- Clip each occurrence's offset loop to its visible intersection before expanding day entries. All recurrence operands are UTC civil midnights, so those offset differences are whole calendar days and do not inherit DST-hour drift.
- The board clock schedules the next household-local midnight with calendar-day arithmetic, not a fixed 24-hour interval, and rechecks on window focus/document visibility. Clock refreshes invalidate the chore query cache, including same-day resumes. Key weekly queries by explicit date range; keep deliberately selected weeks pinned independently of the moving current week.
- When midnight is ambiguous, choose the earliest instant from Luxon's `getPossibleOffsets()` so Today advances at the first midnight. Completion mutations cancel in-flight chore reads before optimism; pause new reads while any completion is pending, invalidate the affected week and Today, then re-enable queries to fetch authoritative state. This prevents clock/resumption refetches from restoring pre-completion state.
- `generateOccurrenceDayKeys()` returns the visible day keys in range, while `generateOccurrenceDayEntries()` returns one row per visible day in a span tied back to its occurrence start date.
- Weekly progress must deduplicate those day rows by chore id and occurrence start before counting. Use `getWeeklyChoreProgress()` and the shared `isChoreCompleted()` predicate; do not deduplicate by chore id alone, since one series can have overlapping instances.
- Keep `src/lib/occurrences.ts` overlap behavior aligned with the SQL prefilters in `src/lib/repositories/chore-repository.ts`; changing only one side can silently drop or over-include chores.
- The series prefilter requires `end_date > rangeStart` only for `repeat_rule = 'none'`; repeating series use their cutoff and duration, since the origin's end date can precede the requested range. Live SQL tests and plan evidence use the production statement from `chore-series-query.ts` rather than a copied fixed query.
- Series edit exception migration uses `mapOccurrenceStarts()` and the board's recurrence stepping. Map by ordinal within the affected branch, discard keys without a generated target, and clear old keys before writing any mapped exceptions. Run the migration inside the same household transaction as the series update or split.

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

## 7) Dropdown Menu Pattern

For lightweight header/action menus built with native `<details>` / `<summary>`:

- Reuse `src/app/household/board/components/useDetailsDropdown.ts` instead of wiring bespoke outside-click handlers per menu.
- Put related menus in the same `data-details-dropdown-group` so opening one closes its peers.
- Preserve keyboard dismissal (`Escape`) and focus restoration to the trigger when the menu closes.
- Close menus when focus leaves the open `<details>` tree to avoid overlapping open panels for keyboard users.
- Keep an actual heading in the surrounding layout when a dropdown trigger visually replaces prior heading text.

## 8) Maintenance Rule

Documentation and implementation should stay in sync:

- Keep documentation, names, comments, and examples aligned with current behavior.
- Make non-obvious assumptions and edge cases explicit in code or docs where future maintainers are likely to look.
- When inconsistencies are found, fix small safe issues promptly; if a larger issue cannot be resolved in the current change, document the affected files, the risk, and the recommended follow-up.

## 9) Keeping Standards Current

If a recurring surprise gets fixed and becomes a standard:

1. Document the standard here.
2. Remove or shorten the matching note in `AGENTS.md`.

## 10) Members API Consistency

For household member/invite role-management routes:

- Reject self-removal requests (`targetUserId === session user id`) with `400`.
- Keep UI affordances aligned with API behavior for self-role/self-removal restrictions.
- Enforce owner-role protections at the API boundary (`403`): non-owners cannot manage owner memberships or owner-role invites.
- Translate Better Auth business-rule conflicts (for example last-owner) to consistent `409` responses.

## Household mutation locking

Household membership, invitation and deletion guards use `withHouseholdMutationLock`. Its separate
`householdLockPool` has at most ten connections and a five-second connection-acquisition timeout.
Within a guarded callback, an AsyncLocalStorage-aware query-pool facade routes repository `query()`
and Better Auth `connect()` calls to the same physical lock transaction. Other requests use the normal
query pool, so queued advisory-lock clients cannot consume their capacity. The query pool also bounds
connection acquisition to five seconds.

The lock client holds a transaction-scoped single-key advisory lock for the entire callback. PostgreSQL
`lock_timeout` is five seconds; acquisition timeout returns `409 HOUSEHOLD_MUTATION_BUSY`. Commit/rollback
releases the lock. Cleanup failures discard the client rather than returning a possibly locked connection
to the pool. Dedicated-pool checkout saturation is also a retryable busy response; genuine connection
failures retain the normal internal-error response. The pg-pool checkout timeout currently has no
SQLSTATE, so only its specific queue-timeout error is translated.
Guarded business writes share the lock transaction: connection loss rolls them back, and subsequent
or deferred queries are fenced. SDK nested transactions use savepoints and serialized connection
leases. Callbacks must await their database work and release every borrowed client. Unguarded chore
writes are unaffected by this transaction scope.

Account deletion first locks the user row with `FOR UPDATE NOWAIT`, so new membership foreign-key
checks serialize with it and a busy row fails immediately with the retryable conflict.
It reads the membership snapshot in a subsequent statement, then takes the same locks for every
active household membership, in household-id order,
with `pg_try_advisory_xact_lock` on its existing data transaction and returns the same retryable conflict
immediately when busy. It must not wait for household
locks while holding query-pool connections. Delete-token replacement uses a separate two-key user-lock
namespace so a user id cannot collide with a household id.

Persist invitation state and its secret hash inside the household lock, then send SMTP outside it.
Delivery remains best-effort, reported by `inviteEmailSent`. A subsequent resend rotates the prior secret;
email delivery is not a transaction with membership state.

## 11) Chore Mutation Contract

For `PATCH /api/chores`:

- Support `action: "create" | "set" | "cancel" | "edit"`.
- All chore writers execute under the shared household lock transaction. Read the source/exception state inside that transaction; cancellation/truncation, replacement insertion and completion copying commit together. Any write failure rolls all of them back. API callers pass the authenticated actor id for membership/management revalidation after acquisition; only trusted internal callers may omit it.
- Keep type omission distinct from an explicit value. Apply the creation default only in the create branch; edit defaults come from the stored chore. Validate supplied types instead of silently substituting a different completion policy.
- For `action: "set"`, validate that `occurrenceStartDate` is a generated series occurrence start date for the chore and return `409` when it is outside schedule.
- For `action: "cancel" | "edit"`, require `scope: "single" | "following" | "all"`.
- Scope semantics follow Google Calendar: `single` affects only the selected occurrence, `following` affects the selected occurrence plus later ones, and `all` affects the full series definition.
- Scope resolution is based on the selected occurrence's position in the series; do not use household-local `today` as a cutoff.
- Inline preview date fields describe the selected occurrence, so send `dateBasis: "occurrence"`. For whole-series results, translate the day delta and duration in the service using the stored origin. Keep default/`series` requests absolute for existing series-date forms, and do not substitute a later occurrence as the new anchor.
- Keep the preview's selected chore and last anchor rectangle during save/refetch while its source card disappears. Rebind to the replacement before invalidating the selection; preserve the session checks so stale callbacks cannot reopen a dismissed or changed preview. Footer buttons must finish their click before any layout collapse that moves them.
- Compare preview drafts with the previous chore snapshot when applying a new object for the same selection. Update clean fields, preserve dirty fields/editor state, and read status from the refreshed chore; an object identity change alone must not reset an unsaved draft.
- Reconcile successful title/notes saves only when the current draft still matches the submitted text. Use shared `normalizeChoreNotes()` for the server's trim/500-character cap. Clear saved drafts explicitly, including saves whose normalized server value did not change and therefore produced no new chore object. Background merges must compare raw draft values so unsent spaces/newlines survive; retain focus inside the preview and scope popup when data refreshes.
- On no-op edits, restore the exact stored title/notes value rather than normalizing it again. Trim-before-cap can leave a stored 500-character note ending in whitespace, so notes normalization is not idempotent. Type-change saves also submit the current title draft and must reconcile it after success.
- For `scope: "single"`, cancel upserts a `kind = canceled` exception and edit creates a detached one-off chore while canceling the original occurrence.
- For `scope: "following"`, require a repeating chore (`repeatRule !== "none"`) and truncate the original series before the targeted occurrence unless that occurrence is the first series instance; first-instance `following` falls through to whole-series behavior.
- For `scope: "all"`, cancel marks the source series row canceled and edit updates the current series row in place using the submitted fields/defaults.
- Keep `UndoToastStack` and related undo UI pieces isolated so they can be reconnected later without shaping the active mutation contract.

## 12) Invite Deduplication Contract

For household invite creation:

- Keep email normalization (`trim().toLowerCase()`) before persistence.
- Enforce one pending invite per `(household, email)` with a partial unique DB index. Better Auth duplicate-active-invite errors currently return `409 USER_ALREADY_INVITED`, including the existing invitation when available.
- Before creating a replacement, retire expired pending rows for the normalized household/email and clear their secret hashes inside the household lock transaction.
- Authorized resends refresh expired pending rows in place, preserving invitation id and role, then rotate the secret using the shared seven-day lifetime. Owner-role checks happen before refresh.
- A violation of the pending-email index aborts the current transaction. Retry once only after rollback and lock release; repeated conflicts return `409 USER_ALREADY_INVITED`. Do not query or retry inside a failed transaction, and do not classify other unique indexes as invitation conflicts.
- The members snapshot includes expired pending invitations with `expired: true` so users can resend or revoke them. Terminal canceled/accepted/rejected rows are excluded.

## 13) Invite Acceptance Handoff

For household invite acceptance:

- Treat household membership as multi-household capable; invite acceptance should not reject users solely because they already belong to another household.
- Keep the session-email check strict: only the invited email can accept the invite.
- When the wrong account is signed in, prefer an explicit sign-out-and-continue handoff that preserves the invite callback instead of weakening the default signed-in redirect behavior on `/auth`.
- If membership is created but post-accept active-household switching fails, recover to a household selection/setup path instead of bouncing back to an already-consumed invite.
- For local redirect targets, use `src/lib/safe-local-path.ts` instead of ad-hoc checks. Decode once when validating user-entered callback params (for example `/auth`), but keep nested redirect targets encoded when validating values already parsed from `URLSearchParams` (for example `/signout?redirectTo=...`) so inner callback query strings are not truncated. Reject network-path variants using both `/` and `\` prefixes; backslash forms like `/\\evil.com` are not safe local paths.

## 14) Build vs Buy Recommendation Standard

When proposing implementation approaches (in issues, plans, or PR summaries):

- Default to proven, well-maintained libraries/tools before proposing a custom in-house implementation.
- For non-trivial decisions, provide a concise tradeoff comparison with both options:
  - Ready-to-import library/tool: pros and cons (reliability, maturity, ecosystem fit, integration effort, lock-in risk).
  - In-house solution: pros and cons (control, customization, delivery time, maintenance burden, long-term risk).
- End with a clear recommendation and rationale; choose in-house only when constraints require it (for example domain-specific requirements, licensing/compliance limits, or lack of a mature ecosystem fit).

## 15) PoC Database Compatibility Policy

Current project posture:

- This repository is a Proof of Concept (PoC) with no production data yet.
- We do not require backward-compatible schema migrations across historical local/dev data.
- It is acceptable for schema changes to break old local data, as long as the current version works correctly end-to-end.
- When schema-breaking changes are introduced, prefer clear reset/seed instructions in the same PR so teammates can get back to a working state quickly.
