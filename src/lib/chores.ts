import { pool } from "@/lib/db";

export const ensureChoresTable = async () => {
  await pool.query(
    "create table if not exists households (id serial primary key, name text not null, time_zone text not null default 'UTC', created_at timestamptz not null default now())",
  );

  await pool.query(
    'create table if not exists users (id serial primary key, name text, email text unique, "emailVerified" timestamptz, image text, created_at timestamptz not null default now())',
  );

  await pool.query(
    'create table if not exists accounts (id serial primary key, "userId" integer not null references users(id) on delete cascade, type text not null, provider text not null, "providerAccountId" text not null, refresh_token text, access_token text, expires_at bigint, id_token text, scope text, session_state text, token_type text, unique(provider, "providerAccountId"))',
  );

  await pool.query(
    'create table if not exists sessions (id serial primary key, "userId" integer not null references users(id) on delete cascade, expires timestamptz not null, "sessionToken" text not null unique)',
  );

  await pool.query(
    "create table if not exists verification_token (identifier text not null, expires timestamptz not null, token text not null, primary key(identifier, token))",
  );

  await pool.query(
    "create table if not exists household_memberships (id serial primary key, household_id integer not null references households(id) on delete cascade, user_id integer not null references users(id) on delete cascade, role text not null, status text not null default 'active', joined_at timestamptz not null default now(), unique(household_id, user_id))",
  );

  await pool.query(
    "create table if not exists chores (id serial primary key, household_id integer not null references households(id) on delete cascade, title text not null, type text not null, start_date date not null, end_date date not null, series_end_date date, repeat_rule text not null, status text not null default 'active', notes text, created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists chore_occurrence_overrides (id serial primary key, chore_id integer not null references chores(id) on delete cascade, occurrence_date date not null, status text not null, closed_reason text, undo_until timestamptz, updated_at timestamptz not null default now(), unique(chore_id, occurrence_date))",
  );
};
