The role of this file is to describe common mistakes and confusion points that agents might
encounter as they work in this project. If you ever encounter something in the project that
surprises you, please alert the developer working with you and indicate that this is the case
in the AGENTS.md file to help prevent future agents from having the same issue.

- After any code changes, run `yarn dev:fix` and report the results. This repo uses Yarn (not npm or pnpm).
- Surprise to watch for: Drizzle migration bookkeeping can persist outside `public` (e.g. in `drizzle` schema). If `db:reset` only recreates `public`, `drizzle-kit migrate` may report success without recreating app tables, and seed scripts can fail with `relation "households" does not exist`.
