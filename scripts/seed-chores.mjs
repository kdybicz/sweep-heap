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

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekDayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekDayIndex);
  return start;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
    "create table if not exists chores (id serial primary key, title text not null, type text not null, start_date date not null, end_date date not null, repeat_rule text not null, status text not null default 'active', created_at timestamptz not null default now())",
  );
  await pool.query(
    "create table if not exists chore_occurrence_overrides (id serial primary key, chore_id integer not null references chores(id) on delete cascade, occurrence_date date not null, status text not null, closed_reason text, updated_at timestamptz not null default now(), unique(chore_id, occurrence_date))",
  );

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekMonday = addDays(weekStart, 0);
  const weekTuesday = addDays(weekStart, 1);
  const weekThursday = addDays(weekStart, 3);
  const weekFriday = addDays(weekStart, 4);
  const weekSaturday = addDays(weekStart, 5);

  const chores = [
    {
      title: "Sweep kitchen",
      type: "close_on_done",
      start_date: toDateString(weekMonday),
      end_date: toDateString(addDays(weekMonday, 28)),
      repeat_rule: "week",
    },
    {
      title: "Water plants",
      type: "stay_open",
      start_date: toDateString(weekTuesday),
      end_date: toDateString(addDays(weekTuesday, 28)),
      repeat_rule: "week",
    },
    {
      title: "Take out trash",
      type: "close_on_done",
      start_date: toDateString(weekThursday),
      end_date: toDateString(addDays(weekThursday, 28)),
      repeat_rule: "week",
    },
    {
      title: "Weekly reset",
      type: "stay_open",
      start_date: toDateString(weekFriday),
      end_date: toDateString(weekSaturday),
      repeat_rule: "week",
    },
  ];

  for (const chore of chores) {
    await pool.query(
      "insert into chores (title, type, start_date, end_date, repeat_rule) values ($1, $2, $3, $4, $5)",
      [
        chore.title,
        chore.type,
        chore.start_date,
        chore.end_date,
        chore.repeat_rule,
      ],
    );
  }

  await pool.end();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
