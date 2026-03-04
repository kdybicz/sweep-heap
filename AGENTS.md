The role of this file is to describe common mistakes and confusion points that agents might
encounter as they work in this project. If you ever encounter something in the project that
surprises you, please alert the developer working with you and indicate that this is the case
in the AGENTS.md file to help prevent future agents from having the same issue.

- After code changes, run `yarn dev:fix` and report the results. For docs-only updates, skip this unless explicitly requested. This repo uses Yarn (not npm or pnpm).
- Surprise to watch for: Drizzle migration bookkeeping can persist outside `public` (e.g. in `drizzle` schema). If `db:reset` only recreates `public`, `drizzle-kit migrate` may report success without recreating app tables, and seed scripts can fail with `relation "households" does not exist`.
- `@next/env` import interop can differ across runners (Node ESM vs Drizzle/tsx transpilation). In Node-run `.mjs` scripts, use `import * as nextEnv from "@next/env"` and resolve with `nextEnv.default ?? nextEnv` before destructuring `loadEnvConfig`; keep `drizzle.config.ts` on the simpler `import { loadEnvConfig } from "@next/env"` unless migrate tooling shows interop issues.
- Surprise to watch for: `drizzle-kit generate` expects `drizzle/meta/_journal.json` to exist. If you wipe migration history, recreate `_journal.json` with empty `entries` before generating, or generation fails with `ENOENT drizzle/meta/_journal.json`.
- Surprise to watch for: `.env.local` values are dotenv-style, not shell-safe. `SMTP_FROM=Chore Share <no-reply@localhost>` breaks `source .env.local` in bash, so wrapper scripts should use `@next/env`/dotenv parsing instead of shell sourcing.
