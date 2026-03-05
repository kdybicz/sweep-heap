# Chores

This is a Next.js 16 app for shared household chores, backed by PostgreSQL and Better Auth magic-link sign-in.

## Project Docs

- `docs/requirements.md` - product requirements and behavior.
- `docs/requirements-quick-reference.md` - condensed product rules.
- `docs/engineering-patterns.md` - canonical implementation patterns and contracts.

## Local Environment Requirements

- Node.js 24 (see `.nvmrc` and `package.json#engines`)
- Corepack enabled (`corepack enable`) so `yarn@4.12.0` is used
- Docker + Docker Compose (for local Postgres and Mailpit)

## Required Environment Variables

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

The app expects these variables:

- `DATABASE_URL` (Postgres connection string)
- `AUTH_URL` (local app URL, usually `http://localhost:3000`)
- `AUTH_SECRET` (required by Better Auth; generate a strong random value)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (email transport; defaults target local Mailpit on port `1125`)
- `SMTP_SECURE` (optional; `true`/`false` override, otherwise inferred from port `465`)

For local Mailpit, leave `SMTP_USER` and `SMTP_PASS` empty (omit credentials).

### Agent/Container Overrides

If you run commands inside a container (for example this coding agent) and the host app/database live on your machine, keep `.env.local` pointed at `localhost` for normal host development.

Use the shared `Makefile` for commands. When `AGENT` is set (it is set by default in OpenCode sandboxes), `make` automatically overrides these values for container access:

- `DATABASE_URL=postgresql://chores:chores@host.docker.internal:5432/chores`
- `AUTH_URL=http://host.docker.internal:3000`
- `SMTP_HOST=host.docker.internal`

This keeps one command flow for both local devs and agents without dotenv shell parsing.

To test the agent behavior on your host machine:

```bash
AGENT=1 make db-migrate
```

Generate a local auth secret if needed:

```bash
openssl rand -base64 32
```

## Setup, Migrate, Seed, Run

1) Start local services (Postgres + Mailpit):

```bash
docker compose up -d
```

2) Install dependencies:

```bash
make install
```

3) Prepare the database schema:

```bash
make db-migrate
```

4) Seed demo data:

```bash
make seed-chores
```

5) Run the app:

```bash
make dev
```

## Useful Commands

- Prefer `make` targets first (especially in agent/container environments); use direct `yarn` only when an equivalent `make` target is missing.
- `yarn db:reset` - drops `drizzle` and `public` schemas, recreates `public`, then runs migrations
- `yarn db:migrate` - applies Drizzle migrations
- `yarn db:generate` - generates migration files from `src/lib/drizzle/schema.ts`
- `yarn db:studio` - opens Drizzle Studio
- `make db-migrate` - applies migrations, with automatic agent overrides when `AGENT` is set
- `make db-reset` - resets DB, with automatic agent overrides when `AGENT` is set
- `make seed-chores` - seeds demo data, with automatic agent overrides when `AGENT` is set
- `make db-studio` - opens Drizzle Studio, with automatic agent overrides when `AGENT` is set

## Local URLs

- App: http://localhost:3000
- Mailpit UI: http://localhost:8025
- Postgres: `localhost:5432` (user/password/db: `chores`)
