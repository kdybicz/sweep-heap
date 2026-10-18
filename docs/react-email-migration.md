# React Email 6 migration and compatibility

Assessed on 2026-10-16 for [#35](https://github.com/kdybicz/sweep-heap/issues/35).

## Supported path and selected release

The [official 5 → 6 migration guide](https://react.email/docs/getting-started/updating-react-email)
and [changelog](https://react.email/docs/changelog) consolidate components and rendering utilities
into `react-email`, and rename the preview server to `@react-email/ui`. The deprecated component
packages are replaced by this maintained API, not by another email framework.

| Package | Selected version / role | Compatibility evidence |
| --- | --- | --- |
| `react-email` | `6.11.1`, runtime dependency | Node `>=20.19.0`, React/React DOM 18 or 19; compatible with our Node 24 and aligned React 19.2.8 pins |
| `@react-email/ui` | `6.11.1`, dev dependency | Official preview-server replacement; CLI discovers the installed UI; all three preview iframes verified |
| `@react-email/render` | `2.1.0`, transitive | Maintained renderer re-exported by `react-email`; no direct application import/pin needed |

Registry metadata: [`react-email@6.11.1`](https://registry.npmjs.org/react-email/6.11.1),
[`@react-email/ui@6.11.1`](https://registry.npmjs.org/@react-email/ui/6.11.1).
They were published on 2026-10-06 at 19:31:25Z and 19:33:38Z respectively. At assessment time,
6.11.1 is the newest stable pair eligible under `npmMinimalAgeGate: 3d`: 6.11.2 was published
2026-10-14, while 6.11.3 was published 2026-10-16. Exact direct pins remain in place, install
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

`@react-email/ui@6.11.1` declares exact `next@16.3.3`, so the old preview-server resolution moves
to the narrow descriptor `@react-email/ui/next: 16.3.8`. Application Next.js stays at 16.3.8.
The security exception is still necessary: removing it would reintroduce an older Next.js tree.
Registry audit metadata identifies 16.3.3 as affected by
[`GHSA-vcvr-r3jv-pc5j`](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)
(critical, fixed in 16.3.6) and
[`GHSA-cjq9-62q9-8jv4`](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)
(high, fixed in 16.3.8), plus lower-severity findings fixed by 16.3.8.
Do not remove or replace the whole resolutions block as part of this rename.

[#18](https://github.com/kdybicz/sweep-heap/issues/18) remains the owner of removing this override.
The registry's newer UI 6.11.3 declares Next 16.4.1, but that UI release is not yet age-eligible
at assessment time. Recheck its dependency eligibility, advisories and runtime compatibility
under the normal [security-update process](security-updates.md) before adopting it without a pin.

On 2026-10-18, forcing the existing UI 6.11.1 override to the age-eligible Next 16.4.1 was tested
twice. Preview startup failed with `ENOENT` for `.next/server/preview-props.json`; restoring 16.3.8
made all three template iframe checks pass. Keep the compatible 16.3.8 override until the aligned
UI release is eligible. UI 6.11.3 becomes eligible on 2026-10-19 at 19:02:44.336 UTC; renderer
2.1.1, required by the aligned CLI, becomes eligible earlier that day. No age exception is approved.

The migration removes all React Email deprecation notices and its esbuild 0.27.4 tree. Both the
CLI and UI resolve esbuild 0.28.2, which is outside the recorded vulnerable ranges. The unfiltered
recursive audit still reports these development-tool findings under
[#16](https://github.com/kdybicz/sweep-heap/issues/16):

- `GHSA-67mh-4wv8-2f99` (moderate): esbuild 0.18.20 via Drizzle Kit → deprecated esbuild-kit loader/core-utils.
- The esbuild-kit loader/core-utils deprecation notices also remain in that Drizzle tree.

The low Windows development-server advisory `GHSA-g7r4-m6w7-qqqr` was removed on 2026-10-18 by
refreshing Drizzle Kit's existing `tsx ^4.21.0` range to tsx 4.23.15 / esbuild 0.28.2. This needs
neither a direct tsx dependency nor a forced esbuild resolution. Drizzle's migration metadata check
and loading `drizzle.config.ts` through the updated tsx runner both pass without changing the DB.

No global esbuild override is added: those parents constrain incompatible versions. The high/critical
audit reports no suggestions. Existing UI peer-packaging warnings remain nonfatal; real Node/Next
rendering, production build and preview startup are verified rather than hidden with new overrides.
