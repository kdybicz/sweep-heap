The role of this file is to describe common mistakes and confusion points that agents might
encounter as they work in this project. If you ever encounter something in the project that
surprises you, please alert the developer working with you and indicate that this is the case
in the AGENTS.md file to help prevent future agents from having the same issue.

- Command precedence in this repo: prefer `make` targets first, and use direct `yarn` only when an equivalent `make` target is missing.
- After code changes, run `make dev-fix` and report the results. For docs-only updates, skip this unless explicitly requested. (This repo uses Yarn under the hood, not npm or pnpm.)
- Canonical implementation standards belong in `docs/engineering-patterns.md`; keep this file focused on surprises and agent workflow gotchas.
- Surprise to watch for: Drizzle migration bookkeeping can persist outside `public` (e.g. in `drizzle` schema). If `db:reset` only recreates `public`, `drizzle-kit migrate` may report success without recreating app tables, and seed scripts can fail with `relation "households" does not exist`.
- `@next/env` import interop can differ across runners (Node ESM vs Drizzle/tsx transpilation). In Node-run `.mjs` scripts, use `import * as nextEnv from "@next/env"` and resolve with `nextEnv.default ?? nextEnv` before destructuring `loadEnvConfig`; keep `drizzle.config.ts` on the simpler `import { loadEnvConfig } from "@next/env"` unless migrate tooling shows interop issues.
- Surprise to watch for: `drizzle-kit generate` expects `drizzle/meta/_journal.json` to exist. If you wipe migration history, recreate `_journal.json` with empty `entries` before generating, or generation fails with `ENOENT drizzle/meta/_journal.json`.
- Surprise to watch for: `.env.local` values are dotenv-style, not shell-safe. `SMTP_FROM=Chore Share <no-reply@localhost>` breaks `source .env.local` in bash, so wrapper scripts should use `@next/env`/dotenv parsing instead of shell sourcing.
- Surprise to watch for: Makefile env parsing is not dotenv-compatible; avoid `include .env`/`source .env.local` patterns. Use `@next/env` in Node and rely on explicit `Makefile` exports for `AGENT` overrides.
- Surprise to watch for: running `yarn db:*` directly in agent/container contexts can use `.env.local` localhost values and fail (`ECONNREFUSED 127.0.0.1:5432`). Prefer `make db-*`/`make seed-chores`, which apply `AGENT` host overrides.
- Surprise to watch for: invite create/resend routes intentionally swallow SMTP send errors and still return `ok: true` with `inviteEmailSent: false`; check this flag when debugging invite delivery.
