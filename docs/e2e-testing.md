# Live E2E testing

The Playwright harness runs against real PostgreSQL and Mailpit, including magic-link verification,
household invitations, chore mutations, browser editing, and account deletion. It starts and stops
its own Next.js instance on `http://127.0.0.1:3100`, with a separate `.next-e2e` build directory.
An existing app on that port causes a failure rather than being reused.
The test app uses `tsconfig.e2e.json` so Next.js can register its generated route types without
rewriting the main app's TypeScript configuration.

## Install and run

Use the Node.js, Corepack, `.env.local`, PostgreSQL and Mailpit setup from the README. The database
must already have the current migrations. The harness does not reset, seed or migrate it.

```bash
make install
make e2e/install
make test/e2e
```

`make test/e2e` runs the passing smoke flow: sign-in, board rendering, invitation acceptance,
chore create/complete/cancel, protected household deletion, member leave, and emailed account
deletion. All test accounts use unique `e2e-<uuid>-...@example.com` addresses.

```bash
make test/e2e/regressions
make test/e2e/contention
```

The regression suite asserts intended behavior for the confirmed issues. Each current defect has
an issue-linked `test.fail()` marker. A reproduced assertion failure is reported as expected;
when a fix makes the test pass, Playwright reports an **unexpected pass** and exits nonzero until
the marker is removed. Setup failures before the marker remain ordinary failures.
The #19 organization-boundary cases are passing regressions without expected-failure markers. They
verify blocked public auth routes have no database side effects while guarded member, invitation,
ownership-transfer and household workflows continue to work.
The #21 invitation-recovery cases also pass normally: expired-row visibility, replacement and resend,
old-secret rejection, concurrent normalized-email creation and raw unique-index rollback/recovery.
The #22 cases pass normally and verify omitted/explicit types across all edit scopes, validation before
storage changes, actual completion behavior, and an inline notes edit in Chromium.
The #23 cases pass normally and cover browser duration changes from later instances, forward/backward
series shifts, absolute-date compatibility and scope boundaries.
The #24 cases pass normally. Scoped PostgreSQL failures exercise replacement insertion and completion
copying across edit scopes, verifying source bounds/state and absence of partial replacements, with
successful retry. The contention suite also checks queued chore permission revalidation.
The #25 cases pass normally and cover following/whole-series exception preservation, mixed state and
cancellation keys, shifts into occupied keys, cadence changes and shortened cutoffs. Scoped PostgreSQL
failures after the first copied exception verify complete rollback and successful retry.

The contention suite is separate because it deliberately queues ten requests behind a disposable
household's PostgreSQL advisory lock. It verifies those connections belong to the dedicated lock pool,
health remains responsive during saturation, and all ten requests finish after release. These are passing
regressions without `test.fail()` markers. Additional cases check bounded busy responses, recovery and
account-deletion token preservation, user-lock namespace isolation, and retryable invite acceptance
through both the POST API and the post-sign-in completion callback.
Fault injection pauses only a fixture invitation insert and deliberately terminates its identified
managed-app lock backend to verify transaction rollback, fencing and recovery. Another case verifies
regular-member deletion cannot overlap an ownership transfer.
Failure cleanup cancels only backends identified by the fixture lock; it never calls
`pg_terminate_backend` during cleanup, never reuses another app server, and does not belong in the default Vitest gate.
It is registered only when the dedicated contention command sets `E2E_SUITE=contention`.
The queue must reach ten connections before the health probe; incomplete fixture setup fails normally
instead of being interpreted as a fixed product bug.

## Docker and agent environments

When `AGENT` is set, Make uses `host.docker.internal` for PostgreSQL, SMTP and the Mailpit API.
The managed test app still runs inside the container, with its own loopback auth origin:

```bash
AGENT=1 make test/e2e
```

Chromium requires OS libraries and fonts. On a supported host or an image where package installation
is available, install them with `yarn playwright install-deps chromium`. Rootless minimal agent images
should use a matching Playwright image rather than relying on a previous container's private libraries.
For example, with `.env.local` pointing to the README's local services:

```bash
docker run --rm --init --ipc=host --platform linux/amd64 \
  --add-host=host.docker.internal:host-gateway \
  -v "$PWD:/work" -w /work \
  -e DATABASE_URL=postgresql://chores:chores@host.docker.internal:5432/chores \
  -e SMTP_HOST=host.docker.internal \
  -e E2E_MAILPIT_URL=http://host.docker.internal:8025 \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -lec '
    if ! command -v corepack >/dev/null; then
      npm uninstall --global yarn
      npm install --global corepack
    fi
    corepack yarn@4.12.0 install --immutable
    corepack yarn@4.12.0 test:e2e
  '
```

The image supplies browser libraries and fonts. The workspace bind mount contains the harness and
all resulting reports; nothing under another container's `/tmp` is required. Follow the pinned Node.js
24 requirement if choosing a different test image. The sample's platform matches the `x64` dependency
architecture configured in `.yarnrc.yml`.

## Configuration

The config loads dotenv values through `@next/env`. Exported Make/environment values take precedence.

| Variable | Default / purpose |
| --- | --- |
| `E2E_BASE_URL` | `http://127.0.0.1:3100`; managed local HTTP origin and port; an optional root trailing slash is normalized away |
| `E2E_DATABASE_URL` | Falls back to `DATABASE_URL`; used by both the app and fixture queries |
| `E2E_MAILPIT_URL` | `http://localhost:8025`, or the host override under `AGENT` |
| `PLAYWRIGHT_BROWSERS_PATH` | Make defaults to workspace `.e2e/browsers`; may point to a preinstalled browser directory |

The app subprocess overrides `AUTH_URL` to the test origin. SMTP settings and `AUTH_SECRET` come from
the usual environment. `E2E_BASE_URL` must use `localhost` or `127.0.0.1` so these suites always manage
their own local server. Tests run with one worker and no retries to keep session/household mutations
deterministic.
Credentials, non-root paths, query strings and fragments in `E2E_BASE_URL` are rejected. Pure URL
configuration tests run in the default Vitest gate and do not require the live stack.

## Fixtures, cleanup and artifacts

- Each test creates a new household. Worker-scoped test users have isolated browser contexts.
- Household fixtures delete their own rows after each test. Worker cleanup also catches partially
  completed signup/create responses using the unique run prefix, then removes only matching emails
  from Mailpit and verifies that no fixture users/households remain.
- The atomic-edit regression temporarily creates an insert-failure trigger restricted to its fixture
  household and replacement title, and drops the trigger/function in `finally`.
- Expiry tests modify only fixture invitations. Midnight tests advance Playwright's browser clock.
- Cleanup runs on ordinary assertion/setup failures. A killed container cannot run teardown; a report's
  unique fixture prefix identifies any leftovers for targeted cleanup. Never reset the shared database
  to remove test fixtures.
- `.e2e/results-smoke.json`, `.e2e/results-regressions.json` and `.e2e/results-contention.json` are the
  machine-readable Playwright reports. Explicit screenshots and sanitized evidence attachments are
  in `.e2e/test-results/<suite>/`. Running one suite preserves the other suites' artifacts. These
  files are workspace-local and gitignored.
- Browser storage state, videos and traces are not saved. API helpers strip credential-bearing request
  call logs from errors; do not add raw cookie/token output to reports.

The original review's sanitized results and progress screenshot are retained under
[`docs/reviews/`](reviews/2026-10-11.md). GitHub Issue [#8](https://github.com/kdybicz/sweep-heap/issues/8)
tracks additional integration/E2E coverage.
