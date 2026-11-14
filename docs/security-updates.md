# Dependency security updates

Use this process for routine monthly dependency maintenance and urgent security fixes in The
Sweep Heap. Prefer compatible, age-eligible releases. Any package-age exception requires explicit
user approval.

## Monthly and urgent updates

Monthly updates first bring all dependencies to their latest compatible, age-eligible release,
including non-breaking major releases, then remediate advisories that remain. Start from an
up-to-date `master` branch, work on a dedicated branch, and create a GitHub Issue for deferred
upgrades, advisories, or resolution cleanup.

Use `routine-security-updates-<month>-<year>` for the branch, `Run <Month> routine security
updates` for the commit, and `Routine Security Updates - <Month> <Year>` for the pull request.

Urgent updates between monthly passes are deliberately narrow. Change only runtime dependencies
affected by high or critical advisories, confirm each path with `yarn why <package>`, and leave
development-only, moderate, low, and deprecation findings for the next monthly pass. Do not
refresh unrelated packages, remove existing resolutions, or regenerate the full tree during an
urgent update.

## Rules

- Use Node.js 24 and the Yarn version pinned in `package.json`, via Corepack.
- Prefer existing `make` targets; use direct `yarn` commands where no equivalent target exists.
- Keep `npmMinimalAgeGate: 3d` and `enableScripts: false` in `.yarnrc.yml`.
- Never reduce or disable the age gate or enable dependency install scripts to apply a fix.
- If bypassing the age gate is the only available way to patch a vulnerability, ask the user
  whether to wait or approve an exception. Do not add `npmPreapprovedPackages` without explicit
  approval.
- Prefer upgrading a direct dependency, then its nearest direct parent, before adding a resolution.
- Scope any resolution to the affected dependency descriptor. Do not force incompatible major
  versions through resolutions; handle them as explicit upgrades with migration work and tests.
- Preserve exact direct-dependency pins. Keep `react` and `react-dom` versions aligned, review
  compatibility across Next.js, Better Auth, Drizzle, and React Email packages, and keep
  `@types/node` aligned with Node.js 24.
- Record deferred advisories, held-back breaking upgrades, resolution rationale, and exception
  cleanup in GitHub Issues. Link those issues in the pull request rather than adding a repo-local
  backlog or inline TODO notes.

## 1. Establish the baseline

Review existing work and current GitHub Issues before changing dependencies. Corepack is bundled
with Node.js 24; if unavailable, install it with `npm install --global corepack` first.

```bash
make install
yarn audit
yarn npm audit --recursive
```

`yarn audit` checks recursive high and critical findings; the unfiltered command also reports
lower-severity findings and deprecations. For each advisory, record its identifier, severity,
vulnerable and fixed versions, whether it is runtime or development-only, and its dependency path:

```bash
yarn why <package>
```

Check whether an existing resolution selects the vulnerable version. Deprecation notices are not
security advisories and need separate review. Monthly updates use this audit only as a baseline:
first refresh the dependency tree, because findings can disappear after an upgrade.

## 2. Review temporary controls

Monthly updates only. Skip this step for urgent updates.

Review every existing resolution independently. Retain compatibility pins until a supported parent
release and focused verification show they are unnecessary. Temporarily remove a stale
security-related pin one at a time, regenerate the tree, and inspect the resulting diff before
deciding whether to remove it permanently. Do not remove the whole `resolutions` block.

Remove age-gate preapprovals that are now more than three days old, then omit the key when none
remain. Never remove an exception before its lockfile can resolve without it.

```bash
yarn install
yarn npm audit --recursive
```

## 3. Upgrade the monthly dependency tree

Monthly updates only. Skip this step for urgent updates.

Refresh lockfile entries already permitted by dependency ranges, then align exact direct pins with
the newest age-eligible versions. `npm-check-updates` can list and edit direct dependencies while
preserving exact pins; it must be an exact-pinned development dependency when used in this repo.

```bash
yarn up -R '**'
yarn ncu
yarn ncu -u
yarn install
```

Use `yarn ncu` to group related upgrades and make major upgrades separately. Yarn's install is the
age-gate authority: if it rejects a candidate younger than three days, retain the prior version and
retry after it is eligible unless the user approves an exception under
[the package age gate](#5-handle-the-package-age-gate).

For every major upgrade, read its changelog or migration guide, make required code changes, and run
focused checks. Keep a major upgrade when it is compatible. If it requires non-trivial migration,
revert it, create a GitHub Issue with the blocker and revisit condition, and continue with the
remaining packages. Re-run `yarn ncu` at the end and record intentionally held-back upgrades in
their issues and the pull request.

Review `package.json` and `yarn.lock` after each group for unexpected major upgrades, downgrades,
duplicate versions, unrelated churn, and pins that prevent newer fixes. If upgrading Yarn itself,
update every explicit version reference, including `package.json`, `make install`,
`.github/actions/setup-ci/action.yml`, the README, and the E2E container commands. Search for the
old version afterward so documentation and executable pins cannot drift.

## 4. Apply remediations

After monthly upgrades, or immediately for an urgent update, rerun both audits. For each remaining
vulnerability:

1. Upgrade the vulnerable direct dependency to a compatible fixed version.
2. Upgrade its nearest direct parent if the vulnerable package is transitive.
3. Add a narrowly scoped resolution only if neither upgrade supplies a compatible fix.

For a targeted direct-dependency upgrade, retain an exact version:

```bash
yarn up --exact <package>@<compatible-version>
```

For a transitive package already permitted by dependency ranges, refresh the relevant lockfile
entries with `yarn up -R <package>`. Then rerun the audit and `yarn why <package>`. In an urgent
update, prefer the smallest version that fixes the affected path and revert unrelated lockfile
churn.

Document every remaining resolution in the pull request and its GitHub Issue: the advisory,
dependency path, selected fixed version, why a parent cannot supply it, and when the pin can be
removed. Recheck existing resolutions on each monthly pass rather than copying them forward
unchanged.

## 5. Handle the package age gate

If a fixed version is less than three days old, first look for a compatible, age-eligible fix
through a direct or parent dependency upgrade. If none exists and bypassing the age gate is the
only way to patch a vulnerability, ask the user whether to wait or approve an exception. Provide
the advisory, exact package/version, publication time, and eligibility time.

Only after explicit approval, add that exact package/version:

```yaml
npmPreapprovedPackages:
  - "package-name@1.2.3"
```

Document the approval, reason, and cleanup date in the pull request and a GitHub Issue. Remove the
exception once the release is three days old, then verify `make install` and both audits. Remove
stale exceptions and omit the key when none remain. Keep the three-day gate unchanged throughout.

If the fix is unpublished or incompatible, document the limitation in a GitHub Issue and link it
in the pull request. Do not hide audit failures with exclusions or `|| true`.

## 6. Review and verify

Inspect `package.json` and `yarn.lock` for unexpected major-version changes or downgrades,
unrelated lockfile churn, duplicate versions, and resolutions or preapprovals that are no longer
necessary. Review migration guides and run focused checks for changed runtime dependencies:

- Magic-link sign-in and session/household guards for Better Auth.
- Server rendering and route behavior for Next.js and React.
- Repository queries for Drizzle and PostgreSQL.
- HTML/text email rendering, Mailpit delivery, and actual preview iframes for React Email and
  Nodemailer.

After dependency changes, follow the repository's required auto-fix pass and review its diff. Then
run the read-only checks and production build:

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

Use the environment setup in the README for builds and runtime checks. Prefer `make` wrappers for
agent/container host overrides; do not shell-source `.env.local`. Do not reset, seed, or migrate
the database merely to verify a dependency update. Update related tests and documentation when
behavior changes.

Completion requires a passing immutable installation, format/lint checks, tests, typecheck, build,
and both audits. No high or critical advisory should remain when a compatible, age-eligible fix is
available. Link deferred findings and necessary resolutions to their GitHub Issues, and confirm any
remaining preapprovals have explicit user approval and a cleanup date.
