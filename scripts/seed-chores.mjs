import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const toDateString = (dateTime) => dateTime.toISODate();

const seed = async () => {
  const envPath = path.join(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(
    "create table if not exists households (id serial primary key, name text not null, time_zone text not null, created_at timestamptz not null default now())",
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

  const timeZone = "Europe/Warsaw";
  const now = DateTime.now().setZone(timeZone).startOf("day");
  const weekStart = now.minus({ days: now.weekday - 1 }).startOf("day");
  const weekMonday = weekStart;
  const weekTuesday = weekStart.plus({ days: 1 });
  const weekThursday = weekStart.plus({ days: 3 });
  const weekFriday = weekStart.plus({ days: 4 });
  const weekSaturday = weekStart.plus({ days: 5 });
  const weekSunday = weekStart.plus({ days: 6 });
  const weekNextMonday = weekStart.plus({ days: 7 });

  const householdResult = await pool.query(
    "insert into households (name, time_zone) values ($1, $2) returning id",
    ["Demo household", "Europe/Warsaw"],
  );
  const householdId = householdResult.rows[0]?.id;

  const userResult = await pool.query(
    'insert into users (name, email, "emailVerified") values ($1, $2, now()) returning id',
    ["Demo User", "demo.user@example.com"],
  );
  const userId = userResult.rows[0]?.id;

  await pool.query(
    "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
    [householdId, userId, "admin"],
  );

  const chores = [
    {
      title: "Sweep kitchen",
      type: "close_on_done",
      start_date: toDateString(weekMonday),
      end_date: toDateString(weekMonday),
      series_end_date: toDateString(weekMonday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Hit corners, under stools, and the pantry mat.",
    },
    {
      title: "Water plants",
      type: "stay_open",
      start_date: toDateString(weekTuesday),
      end_date: toDateString(weekTuesday),
      series_end_date: toDateString(weekTuesday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Top shelf gets a light mist only.",
    },
    {
      title: "Take out trash",
      type: "close_on_done",
      start_date: toDateString(weekThursday),
      end_date: toDateString(weekThursday),
      series_end_date: toDateString(weekThursday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Recycling goes out too.",
    },
    {
      title: "Weekly reset",
      type: "stay_open",
      start_date: toDateString(weekFriday),
      end_date: toDateString(weekSaturday),
      series_end_date: toDateString(weekSaturday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Floors, counters, linens.",
    },
    {
      title: "Weekly planning",
      type: "stay_open",
      start_date: toDateString(weekSunday),
      end_date: toDateString(weekNextMonday),
      series_end_date: toDateString(weekNextMonday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Plan meals and groceries.",
    },
    {
      title: "Monthly review",
      type: "stay_open",
      start_date: "2025-01-01",
      end_date: "2025-01-09",
      series_end_date: null,
      repeat_rule: "month",
      notes: null,
    },
  ];

  for (const chore of chores) {
    await pool.query(
      "insert into chores (household_id, title, type, start_date, end_date, series_end_date, repeat_rule, notes) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        householdId,
        chore.title,
        chore.type,
        chore.start_date,
        chore.end_date,
        chore.series_end_date ?? null,
        chore.repeat_rule,
        chore.notes ?? null,
      ],
    );
  }

  await pool.end();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
