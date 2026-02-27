import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const startOfWeek = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekDayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekDayIndex);
  return start;
};

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const nextDateForDayOfMonth = (dayOfMonth, reference) => {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const candidate = new Date(year, month, dayOfMonth);
  if (candidate < reference) {
    return new Date(year, month + 1, dayOfMonth);
  }
  return candidate;
};

const seed = async () => {
  const envPath = path.join(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(
    "create table if not exists chores (id serial primary key, title text not null, occurrence_date date not null, status text not null default 'open', created_at timestamptz not null default now())",
  );

  await pool.query(
    "create table if not exists chore_occurrence_overrides (id serial primary key, chore_id integer not null references chores(id) on delete cascade, occurrence_date date not null, status text not null, closed_reason text, updated_at timestamptz not null default now(), unique(chore_id, occurrence_date))",
  );

  const weekStart = startOfWeek(new Date());
  const now = new Date();
  const start27 = nextDateForDayOfMonth(27, now);
  const end28 = nextDateForDayOfMonth(28, now);
  const chores = [
    { title: "Sweep kitchen", date: toDateString(weekStart) },
    { title: "Water plants", date: toDateString(addDays(weekStart, 2)) },
    { title: "Take out trash", date: toDateString(addDays(weekStart, 4)) },
    {
      title: "Weekly reset (series start)",
      date: toDateString(start27),
    },
    {
      title: "Weekly reset (series end)",
      date: toDateString(end28),
    },
    {
      title: "Weekly reset (series start)",
      date: toDateString(addDays(start27, 7)),
    },
    {
      title: "Weekly reset (series end)",
      date: toDateString(addDays(end28, 7)),
    },
  ];

  for (const chore of chores) {
    await pool.query(
      "insert into chores (title, occurrence_date) values ($1, $2)",
      [chore.title, chore.date],
    );
  }

  await pool.end();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
