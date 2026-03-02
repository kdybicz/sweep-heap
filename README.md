# Chores

This is a Next.js 16 app for shared household chores, backed by PostgreSQL and NextAuth email sign-in.

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
- `AUTH_SECRET` (required by NextAuth; generate a strong random value)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (email transport; defaults target local Mailpit on port `1125`)

For local Mailpit, leave `SMTP_USER` and `SMTP_PASS` empty (omit credentials).

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

## Local URLs

- App: http://localhost:3000
- Mailpit UI: http://localhost:8025
- Postgres: `localhost:5432` (user/password/db: `chores`)
