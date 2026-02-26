import { pool } from "@/lib/db";

export const ensureChoresTable = async () => {
  await pool.query(
    "create table if not exists chores (id serial primary key, title text not null, occurrence_date date not null, status text not null default 'open', created_at timestamptz not null default now())",
  );
};
