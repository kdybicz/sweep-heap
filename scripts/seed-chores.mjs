import { execFileSync } from "node:child_process";
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

const runMigrations = () => {
  execFileSync("yarn", ["db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
};

const seed = async () => {
  const envPath = path.join(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it.");
  }

  runMigrations();

  const pool = new Pool({ connectionString: databaseUrl });

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
