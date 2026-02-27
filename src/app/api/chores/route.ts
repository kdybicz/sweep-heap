import { DateTime } from "luxon";

import { ensureChoresTable } from "@/lib/chores";
import { pool } from "@/lib/db";

const toDateString = (value: string | null) => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.toISODate();
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
    const parsed = DateTime.fromJSDate(value);
    return parsed.isValid ? parsed.toISODate() : null;
  }
  return null;
};

const generateOccurrences = (
  startDate: string,
  endDate: string,
  rangeStart: string,
  rangeEnd: string,
  repeatRule: string,
  spanDays: number,
  timeZone: string,
) => {
  const occurrences: string[] = [];
  const start = DateTime.fromISO(startDate, { zone: timeZone }).startOf("day");
  const end = DateTime.fromISO(endDate, { zone: timeZone }).startOf("day");
  const from = DateTime.fromISO(rangeStart, { zone: timeZone }).startOf("day");
  const to = DateTime.fromISO(rangeEnd, { zone: timeZone }).startOf("day");

  if (!start.isValid || !end.isValid || !from.isValid || !to.isValid) {
    return occurrences;
  }

  if (end < from || start > to) {
    return occurrences;
  }

  const clampStart = start > from ? start : from;
  const clampEnd = end < to ? end : to;

  const addOccurrenceSpan = (occurrenceStart: DateTime) => {
    const daySpan = Math.max(spanDays, 1);
    for (let offset = 0; offset < daySpan; offset += 1) {
      const day = occurrenceStart.plus({ days: offset });
      if (day < clampStart || day > clampEnd) {
        continue;
      }
      const isoDate = day.toISODate();
      if (!isoDate) {
        continue;
      }
      occurrences.push(isoDate);
    }
  };

  if (repeatRule === "none") {
    if (start >= clampStart && start <= clampEnd) {
      addOccurrenceSpan(start);
    }
    return occurrences;
  }

  let cursor = start;
  while (cursor < clampStart) {
    if (repeatRule === "day") {
      cursor = cursor.plus({ days: 1 });
    } else if (repeatRule === "week") {
      cursor = cursor.plus({ weeks: 1 });
    } else if (repeatRule === "month") {
      cursor = cursor.plus({ months: 1 });
    } else if (repeatRule === "year") {
      cursor = cursor.plus({ years: 1 });
    } else {
      break;
    }
  }

  while (cursor <= clampEnd) {
    addOccurrenceSpan(cursor);
    if (repeatRule === "day") {
      cursor = cursor.plus({ days: 1 });
    } else if (repeatRule === "week") {
      cursor = cursor.plus({ weeks: 1 });
    } else if (repeatRule === "month") {
      cursor = cursor.plus({ months: 1 });
    } else if (repeatRule === "year") {
      cursor = cursor.plus({ years: 1 });
    } else {
      break;
    }
  }

  return occurrences;
};

export async function GET(request: Request) {
  try {
    await ensureChoresTable();
    const requestUrl = new URL(request.url);
    const start = toDateString(requestUrl.searchParams.get("start"));
    const end = toDateString(requestUrl.searchParams.get("end"));
    const householdId = requestUrl.searchParams.get("householdId") ?? "1";

    const householdResult = await pool.query("select id, time_zone from households where id = $1", [
      householdId,
    ]);
    const household = householdResult.rows[0];
    const timeZone = household?.time_zone;

    const seriesResult = await pool.query(
      "select id, title, type, start_date, end_date, series_end_date, duration_days, repeat_rule, status from chores where status = 'active' and household_id = $1",
      [householdId],
    );

    const overridesResult = await pool.query(
      "select o.chore_id, o.occurrence_date, o.status, o.closed_reason from chore_occurrence_overrides o join chores c on c.id = o.chore_id where c.household_id = $1",
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

    const todayKey = DateTime.now().setZone(timeZone).toISODate() ?? DateTime.now().toISODate();
    const rangeStart = start ?? todayKey;
    const rangeEnd = end ?? todayKey;

    const chores = seriesResult.rows.flatMap((row) => {
      const seriesStart = normalizeDate(row.start_date);
      const occurrenceEnd = normalizeDate(row.end_date);
      const seriesEnd = normalizeDate(row.series_end_date) ?? rangeEnd;
      if (!seriesStart || !seriesEnd || !occurrenceEnd) {
        return [];
      }
      const startDate = DateTime.fromISO(seriesStart, { zone: timeZone });
      const endDate = DateTime.fromISO(occurrenceEnd, { zone: timeZone });
      const spanDays = Math.max(Math.round(endDate.diff(startDate, "days").days) + 1, 1);
      const occurrences = generateOccurrences(
        seriesStart,
        seriesEnd,
        rangeStart,
        rangeEnd,
        row.repeat_rule,
        spanDays,
        timeZone,
      );
      return occurrences.map((occurrenceDate) => {
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
