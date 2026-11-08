# React Email 6 migration and compatibility

Assessed on 2026-11-08 for [#35](https://github.com/kdybicz/sweep-heap/issues/35).

## Supported path and selected release

The [official 5 → 6 migration guide](https://react.email/docs/getting-started/updating-react-email)
and [changelog](https://react.email/docs/changelog) consolidate components and rendering utilities
into `react-email`, and rename the preview server to `@react-email/ui`. The deprecated component
packages are replaced by this maintained API, not by another email framework.

| Package               | Selected version / role      | Compatibility evidence                                                                                  |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `react-email`         | `6.11.6`, runtime dependency | Node `>=20.19.0`, React/React DOM 18 or 19; compatible with our Node 24 and aligned React 19.3.1 pins   |
| `@react-email/ui`     | `6.11.6`, dev dependency     | Official preview-server replacement; CLI discovers the installed UI; all three preview iframes verified |
| `@react-email/render` | `2.2.0`, transitive          | Maintained renderer re-exported by `react-email`; no direct application import/pin needed               |

Registry metadata: [`react-email@6.11.6`](https://registry.npmjs.org/react-email/6.11.6),
[`@react-email/ui@6.11.6`](https://registry.npmjs.org/@react-email/ui/6.11.6).
They were published on 2026-10-29 at 14:09:51Z and 14:12:59Z respectively and are the newest
stable pair eligible under `npmMinimalAgeGate: 3d`. Exact direct pins remain in place, install
scripts remain disabled, and no age-gate exception was added.

The old direct `@react-email/components`, `@react-email/render` and
`@react-email/preview-server` dependencies are removed. Components and helpers now import from
`react-email`; the shared layout/theme and default template exports/`PreviewProps` remain the
rendering and preview contract. `react-email` moves from dev to runtime dependencies because
server-side transactional templates import it. Its unified distribution also contains CLI
dependencies; the preview UI itself remains development-only.

## Rendering, delivery and preview compatibility

`renderEmailTemplate()` renders HTML once with `render(template)` and derives its text part with
`toPlainText(html)`. This replaces the deprecated `render(template, { plainText: true })` option
and avoids rendering the same template twice. Shared framing, user-content escaping, Unicode,
action URLs with multiple parameters, and sign-in preheader exclusion from text are covered by
the real-renderer tests. These are semantic MIME checks, not byte-for-byte HTML snapshots.

Nodemailer and SMTP configuration/delivery behavior are unchanged. A live Mailpit regression
checks HTML and text for magic-link, household-invite and deletion-confirmation messages; the
smoke flow follows delivered links through sign-in, invitation acceptance and account deletion.
No database reset or migration is needed for this dependency update.

The existing `make email-dev` / `yarn email:dev` wrapper still starts `email dev` on port 3001
with `XDG_CONFIG_HOME=.react-email/config`. A managed Chromium check loaded each of
`/preview/magic-link-email`, `/preview/household-invite-email` and `/preview/delete-account-email`
and verified its actual template iframe. This also verifies the CLI's esbuild binary works with
install scripts disabled. Keep using the wrapper; direct CLI startup can try to write to Home/XDG.

## Security and follow-up ownership

`@react-email/ui@6.11.6` declares exact `next@16.4.3`, which is outside the current Next.js
advisory range. Application Next.js is 16.4.5. The obsolete
`@react-email/ui/next: 16.3.8` resolution is removed: the supported UI now supplies its own secure
Next.js release, so forcing another version is no longer necessary. [#18](https://github.com/kdybicz/sweep-heap/issues/18)
records the completed compatibility investigation.

On 2026-10-18, forcing UI 6.11.1 from Next 16.3.8 to 16.4.1 failed preview startup with `ENOENT`
for `.next/server/preview-props.json`. The aligned UI release avoids that unsupported combination;
keep preview-iframe verification whenever the UI or its Next.js dependency changes.

The migration removes all React Email deprecation notices and its esbuild 0.27.4 tree. Both the
CLI and UI resolve esbuild 0.28.2, which is outside the recorded vulnerable ranges. The unfiltered
recursive audit still reports these development-tool findings under
[#16](https://github.com/kdybicz/sweep-heap/issues/16):

- `GHSA-67mh-4wv8-2f99` (moderate): esbuild 0.18.20 via Drizzle Kit -> deprecated esbuild-kit loader/core-utils.
- The esbuild-kit loader/core-utils deprecation notices also remain in that Drizzle tree.

`GHSA-3g3m-2fjr-6pw4` (moderate) remains through `react-email@6.11.6` -> `glob@13.0.6`.
`react-email@6.11.8` raises the range to `glob ^14.0.3`, but it is still within the three-day age
gate. [#55](https://github.com/kdybicz/sweep-heap/issues/55) records its eligibility time and
required verification. No exception is approved.

The low Windows development-server advisory `GHSA-g7r4-m6w7-qqqr` was removed on 2026-10-18 by
refreshing Drizzle Kit's existing `tsx ^4.21.0` range to tsx 4.23.15 / esbuild 0.28.2. This needs
neither a direct tsx dependency nor a forced esbuild resolution. Drizzle's migration metadata check
and loading `drizzle.config.ts` through the updated tsx runner both pass without changing the DB.

No global esbuild override is added: those parents constrain incompatible versions. The high/critical
audit reports no suggestions. Existing UI peer-packaging warnings remain nonfatal; real Node/Next
rendering, production build and preview startup are verified rather than hidden with new overrides.
