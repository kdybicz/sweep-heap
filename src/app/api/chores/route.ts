import { DateTime } from "luxon";

import { ensureChoresTable } from "@/lib/chores";
import { pool } from "@/lib/db";
import { generateOccurrences } from "@/lib/occurrences";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toDateString = (value: string | null) => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toISODate() : null;
};

const normalizeDate = (value: unknown) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = DateTime.fromISO(value, { zone: "utc" });
    return parsed.isValid ? parsed.toISODate() : null;
  }
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: "utc" });
    return parsed.isValid ? parsed.toISODate() : null;
  }
  return null;
};

export async function GET(request: Request) {
  try {
    await ensureChoresTable();
    const requestUrl = new URL(request.url);
    const start = toDateString(requestUrl.searchParams.get("start"));
    const end = toDateString(requestUrl.searchParams.get("end"));
    const householdId = requestUrl.searchParams.get("householdId") ?? "1";
    const weekOffset = Number(requestUrl.searchParams.get("weekOffset") ?? "0");

    const householdResult = await pool.query("select id, time_zone from households where id = $1", [
      householdId,
    ]);
    const household = householdResult.rows[0];
    const timeZone = household?.time_zone ?? "UTC";

    const seriesResult = await pool.query(
      "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, repeat_rule, status from chores where status = 'active' and household_id = $1",
      [householdId],
    );

    const overridesResult = await pool.query(
      "select o.chore_id, to_char(o.occurrence_date, 'YYYY-MM-DD') as occurrence_date, o.status, o.closed_reason from chore_occurrence_overrides o join chores c on c.id = o.chore_id where c.household_id = $1",
      [householdId],
    );

    const overrides = new Map<string, { status: string; closed_reason: string | null }>();
    for (const row of overridesResult.rows) {
      const dateKey = normalizeDate(row.occurrence_date);
      if (!dateKey) {
        continue;
      }
      overrides.set(`${row.chore_id}:${dateKey}`, {
        status: row.status,
        closed_reason: row.closed_reason ?? null,
      });
    }

    const today = DateTime.now().setZone(timeZone).startOf("day");
    const defaultWeekStart = today.minus({ days: today.weekday - 1 }).plus({ weeks: weekOffset });
    const defaultWeekEnd = defaultWeekStart.plus({ days: 6 });
    const rangeStart = start ?? defaultWeekStart.toISODate() ?? "";
    const rangeEnd = end ?? defaultWeekEnd.toISODate() ?? "";

    const chores = seriesResult.rows.flatMap((row) => {
      const seriesStart = normalizeDate(row.start_date);
      const occurrenceEnd = normalizeDate(row.end_date);
      if (!seriesStart || !occurrenceEnd) {
        return [];
      }
      const occurrences = generateOccurrences({
        startDate: seriesStart,
        endDate: occurrenceEnd,
        rangeStart,
        rangeEnd,
        repeatRule: row.repeat_rule,
        seriesEndDate: normalizeDate(row.series_end_date),
        timeZone,
      });
      return occurrences.map((occurrenceDate: string) => {
        const overrideKey = `${row.id}:${occurrenceDate}`;
        const override = overrides.get(overrideKey);
        return {
          id: row.id,
          title: row.title,
          status: override?.status ?? "open",
          closed_reason: override?.closed_reason ?? null,
          occurrence_date: occurrenceDate,
        };
      });
    });

    return Response.json({
      ok: true,
      timeZone,
      rangeStart,
      rangeEnd,
      chores,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureChoresTable();
    const payload = await request.json();
    const choreId = Number(payload?.choreId);
    const occurrenceDate = normalizeDate(payload?.occurrenceDate);
    const status = payload?.status === "closed" ? "closed" : "open";

    if (!choreId || !occurrenceDate) {
      return Response.json(
        {
          ok: false,
          error: "Missing choreId or occurrenceDate",
        },
        { status: 400 },
      );
    }

    const choreResult = await pool.query("select id from chores where id = $1", [choreId]);
    if (!choreResult.rowCount) {
      return Response.json(
        {
          ok: false,
          error: "Chore not found",
        },
        { status: 404 },
      );
    }

    const closedReason = status === "closed" ? "done" : null;

    await pool.query(
      "insert into chore_occurrence_overrides (chore_id, occurrence_date, status, closed_reason) values ($1, $2, $3, $4) on conflict (chore_id, occurrence_date) do update set status = excluded.status, closed_reason = excluded.closed_reason, updated_at = now()",
      [choreId, occurrenceDate, status, closedReason],
    );

    return Response.json({
      ok: true,
      choreId,
      occurrenceDate,
      status,
      closed_reason: closedReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
