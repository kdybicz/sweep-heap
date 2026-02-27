import { pool } from "@/lib/db";

export const ensureChoresTable = async () => {
  await pool.query(
    "create table if not exists households (id serial primary key, name text not null, time_zone text not null default 'UTC', created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists users (id serial primary key, household_id integer not null references households(id) on delete cascade, email text not null unique, created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists chores (id serial primary key, household_id integer not null references households(id) on delete cascade, title text not null, type text not null, start_date date not null, end_date date not null, series_end_date date, repeat_rule text not null, status text not null default 'active', created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists chore_occurrence_overrides (id serial primary key, chore_id integer not null references chores(id) on delete cascade, occurrence_date date not null, status text not null, closed_reason text, updated_at timestamptz not null default now(), unique(chore_id, occurrence_date))",
  );
};
