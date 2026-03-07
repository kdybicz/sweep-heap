import { execFileSync } from "node:child_process";
import * as nextEnv from "@next/env";
import { DateTime } from "luxon";
import { Pool } from "pg";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;

loadEnvConfig(process.cwd());

const toDateString = (dateTime) => dateTime.toISODate();

const runMigrations = () => {
  execFileSync("yarn", ["db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
};

const seed = async () => {
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

  const householdSeeds = [
    {
      name: "Demo household one",
      slug: "demo-household-one",
      members: [
        {
          name: "Demo One Owner",
          email: "demo.one.owner@example.com",
          role: "owner",
        },
        {
          name: "Demo One Admin",
          email: "demo.one.admin@example.com",
          role: "admin",
        },
        {
          name: "Demo One Member",
          email: "demo.one.member@example.com",
          role: "member",
        },
      ],
    },
    {
      name: "Demo household two",
      slug: "demo-household-two",
      members: [
        {
          name: "Demo Two Owner",
          email: "demo.two.owner@example.com",
          role: "owner",
        },
        {
          name: "Demo Two Admin",
          email: "demo.two.admin@example.com",
          role: "admin",
        },
        {
          name: "Demo Two Member",
          email: "demo.two.member@example.com",
          role: "member",
        },
      ],
    },
  ];

  const chores = [
    {
      title: "Sweep kitchen",
      type: "close_on_done",
      start_date: toDateString(weekMonday),
      end_date: toDateString(weekMonday.plus({ days: 1 })),
      series_end_date: toDateString(weekMonday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Hit corners, under stools, and the pantry mat.",
    },
    {
      title: "Water plants",
      type: "stay_open",
      start_date: toDateString(weekTuesday),
      end_date: toDateString(weekTuesday.plus({ days: 1 })),
      series_end_date: toDateString(weekTuesday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Top shelf gets a light mist only.",
    },
    {
      title: "Take out trash",
      type: "close_on_done",
      start_date: toDateString(weekThursday),
      end_date: toDateString(weekThursday.plus({ days: 1 })),
      series_end_date: toDateString(weekThursday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Recycling goes out too.",
    },
    {
      title: "Weekly reset",
      type: "stay_open",
      start_date: toDateString(weekFriday),
      end_date: toDateString(weekSaturday.plus({ days: 1 })),
      series_end_date: toDateString(weekSaturday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Floors, counters, linens.",
    },
    {
      title: "Weekly planning",
      type: "stay_open",
      start_date: toDateString(weekSunday),
      end_date: toDateString(weekNextMonday.plus({ days: 1 })),
      series_end_date: toDateString(weekNextMonday.plus({ days: 28 })),
      repeat_rule: "week",
      notes: "Plan meals and groceries.",
    },
    {
      title: "Monthly review",
      type: "stay_open",
      start_date: "2025-01-01",
      end_date: "2025-01-10",
      series_end_date: null,
      repeat_rule: "month",
      notes: null,
    },
  ];

  for (const householdSeed of householdSeeds) {
    const householdResult = await pool.query(
      "insert into households (name, slug, time_zone) values ($1, $2, $3) returning id",
      [householdSeed.name, householdSeed.slug, timeZone],
    );
    const householdId = householdResult.rows[0]?.id;

    for (const member of householdSeed.members) {
      const userResult = await pool.query(
        "insert into users (name, email, email_verified) values ($1, $2, $3) returning id",
        [member.name, member.email, true],
      );
      const userId = userResult.rows[0]?.id;

      await pool.query(
        "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
        [householdId, userId, member.role],
      );
    }

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
  }

  await pool.end();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
