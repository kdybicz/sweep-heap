# Dependency security updates

Use this process for routine dependency maintenance in The Sweep Heap. Prefer compatible
releases that have passed the package age gate. Any age-gate exception requires explicit
user approval.

## Rules

- Use Node.js 24 and the Yarn version pinned in `package.json`, via Corepack.
- Prefer existing `make` targets; use direct `yarn` commands where no equivalent target exists.
- Keep `npmMinimalAgeGate: 3d` and `enableScripts: false` in `.yarnrc.yml`.
- Never reduce or disable the age gate or enable dependency install scripts to apply a fix.
- If bypassing the age gate is the only available way to patch a vulnerability, ask the user
  what to do before proceeding. Do not add `npmPreapprovedPackages` without explicit approval.
- Prefer upgrading a direct dependency, then its nearest direct parent, before adding a resolution.
- Scope any resolution to the affected dependency descriptor. Do not force incompatible major
  versions through resolutions; handle them as explicit upgrades with migration work and tests.
- Preserve exact direct-dependency pins. Keep `react` and `react-dom` versions aligned, and review
  compatibility across Next.js, Better Auth, Drizzle, and the React Email packages when updating them.
- Keep `@types/node` aligned with Node.js 24.
- Record deferred advisories, resolution rationale, and exception cleanup in GitHub Issues.
  Link those issues in the PR rather than adding a repo-local backlog or inline TODO notes.

## 1. Establish the baseline

Start from an up-to-date branch and review any existing work before changing dependencies.
Corepack is bundled with Node.js 24; if unavailable, install it with
`npm install --global corepack` first.

```bash
make install
yarn audit
yarn npm audit --recursive
```

`make install` uses an immutable installation. `yarn audit` checks recursive high and critical
findings; the unfiltered command also reports lower-severity findings and deprecations.

For each advisory, record its identifier, severity, vulnerable and fixed versions, and whether
the affected package runs in the application or only in development. Trace its dependency path:

```bash
yarn why <package>
```

Check whether an existing resolution selects the vulnerable version. Deprecation notices are
not themselves security advisories and need separate review.

## 2. Review pins and refresh the dependency tree

Review each existing resolution independently. Temporarily remove stale security pins and
regenerate the tree to see whether parent dependencies now supply a fix. Preserve independently
required compatibility pins, and do not remove the entire resolutions block without reviewing it.

```bash
yarn install
yarn npm audit --recursive
```

For a targeted direct-dependency upgrade, retain an exact version:

```bash
yarn up --exact <package>@<compatible-version>
```

For transitive packages already permitted by the dependency ranges, refresh the relevant lockfile
entries with `yarn up -R <package>`. Then rerun the audit and `yarn why <package>`.

Review `package.json` and `yarn.lock` for unexpected major upgrades, downgrades, duplicate versions,
unrelated changes, and pins that prevent newer fixes. If upgrading Yarn itself, update the explicit
Yarn version in `make install`, `.github/actions/setup-ci/action.yml`, and the README along
with `package.json`.

## 3. Apply remediations

For each remaining vulnerability:

1. Upgrade the direct dependency to a compatible fixed version.
2. Upgrade its nearest direct parent if the vulnerable package is transitive.
3. Add a narrowly scoped resolution only if neither upgrade supplies a compatible fix.

Document each remaining resolution in the PR and a linked GitHub Issue: the advisory, dependency
path, selected fixed version, why the parent cannot supply it, and when the pin can be removed.
Recheck existing resolutions on each maintenance pass rather than copying them forward unchanged.

## 4. Handle the package age gate

If a fixed version is less than three days old, first look for a compatible, age-eligible fix
through a direct or parent dependency upgrade. If none exists and bypassing the age gate is the
only way to patch the vulnerability, ask the user whether to wait or approve an exception.
Provide the advisory, exact package/version, publication time, and time it becomes eligible.

Only after explicit approval, add that exact package/version:

```yaml
npmPreapprovedPackages:
  - 'package-name@1.2.3'
```

Document the approval, reason, and cleanup date in the PR and a GitHub Issue. Remove the exception
once the release is three days old, then verify `make install` and both audits. Remove stale
exceptions and omit the key when none remain. Keep the three-day gate unchanged throughout.

If the fix is unpublished or incompatible, document the limitation in a GitHub Issue and link it
in the PR. Do not hide audit failures with exclusions or `|| true`.

## 5. Verify

After dependency changes, follow the repository's required auto-fix pass and review its diff.
Then run the read-only checks and production build:

```bash
make install
make dev-fix
make dev-check
make build
yarn audit
yarn npm audit --recursive
```

`make dev-fix` writes formatting/lint fixes, then runs tests and typechecking. `make dev-check`
checks formatting, lint, tests, and types. CI currently gates separate `make lint`, `make test`,
and `make typecheck` jobs; the production build is an additional local verification step.

Use the environment setup in the README for builds and runtime checks. Prefer `make` wrappers
for agent/container host overrides; do not shell-source `.env.local`. Do not reset, seed, or
migrate the database merely to verify a dependency update.

Run focused checks for changed runtime dependencies: magic-link sign-in and session/household
guards for Better Auth; server rendering and route behavior for Next.js/React; repository queries
for Drizzle/PostgreSQL; and HTML/text email rendering and Mailpit delivery for React Email/Nodemailer.
Update related tests and documentation when behavior changes. Docs-only changes do not require
`make dev-fix` unless explicitly requested.

Completion requires a passing immutable installation, format/lint checks, tests, typecheck, and
build. No high or critical advisory should remain when a compatible, age-eligible fix is available.
Link any deferred findings and necessary resolutions to their GitHub Issues, and confirm that any
remaining preapprovals have explicit user approval and a cleanup date.
