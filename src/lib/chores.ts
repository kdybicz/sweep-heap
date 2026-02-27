import { pool } from "@/lib/db";

export const ensureChoresTable = async () => {
  await pool.query(
    "create table if not exists chores (id serial primary key, title text not null, type text not null, start_date date not null, end_date date not null, repeat_rule text not null, status text not null default 'active', created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists chore_occurrence_overrides (id serial primary key, chore_id integer not null references chores(id) on delete cascade, occurrence_date date not null, status text not null, closed_reason text, updated_at timestamptz not null default now(), unique(chore_id, occurrence_date))",
  );
};
