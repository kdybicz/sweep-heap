# Chores

This is a Next.js 16 app for shared household chores, backed by PostgreSQL and Better Auth magic-link sign-in.

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

For local Mailpit, leave `SMTP_USER` and `SMTP_PASS` empty (omit credentials).

### Agent/Container Overrides

If you run commands inside a container (for example this coding agent) and the host app/database live on your machine, keep `.env.local` pointed at `localhost` for normal host development and add container-only overrides in `.env.agent.local` (already gitignored by `.env*`):

```bash
cat >.env.agent.local <<'EOF'
DATABASE_URL=postgresql://chores:chores@host.docker.internal:5432/chores
AUTH_URL=http://host.docker.internal:3000
SMTP_HOST=host.docker.internal
EOF
```

Then run `agent:*` scripts from the container. They load `.env.local` and override with `.env.agent.local`.

If you prefer storing overrides outside the repo, set `AGENT_ENV_FILE` before the command:

```bash
AGENT_ENV_FILE=/path/to/agent.env yarn agent:db:migrate
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
corepack yarn@4.12.0 install
```

3) Prepare the database schema:

```bash
yarn db:migrate
```

4) Seed demo data:

```bash
yarn seed:chores
```

5) Run the app:

```bash
yarn dev
```

## Useful Commands

- `yarn db:reset` - drops and recreates `public` schema, then runs migrations
- `yarn db:migrate` - applies Drizzle migrations
- `yarn db:generate` - generates migration files from `src/lib/drizzle/schema.ts`
- `yarn db:studio` - opens Drizzle Studio
- `yarn agent:db:migrate` - runs migrations with container/agent env overrides
- `yarn agent:db:reset` - resets DB with container/agent env overrides
- `yarn agent:seed:chores` - seeds demo data with container/agent env overrides
- `yarn agent:db:studio` - opens Drizzle Studio with container/agent env overrides

## Local URLs

- App: http://localhost:3000
- Mailpit UI: http://localhost:8025
- Postgres: `localhost:5432` (user/password/db: `chores`)
