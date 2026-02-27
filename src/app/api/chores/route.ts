import { ensureChoresTable } from "@/lib/chores";
import { pool } from "@/lib/db";

const toDateString = (value: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateUtc = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDate = (value: unknown) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return formatDateUtc(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return formatDateUtc(parsed);
  }
  return null;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const day = date.getDate();
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== ((month % 12) + 12) % 12) {
    return new Date(year, month + 1, 0);
  }
  return candidate;
};

const addYears = (date: Date, years: number) => {
  const candidate = new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
  if (candidate.getMonth() !== date.getMonth()) {
    return new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0);
  }
  return candidate;
};

const generateOccurrences = (
  startDate: Date,
  endDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
  repeatRule: string,
) => {
  const occurrences: string[] = [];
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const from = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const to = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  if (end < from || start > to) {
    return occurrences;
  }

  const clampStart = start > from ? start : from;
  const clampEnd = end < to ? end : to;

  if (repeatRule === "none") {
    if (start >= clampStart && start <= clampEnd) {
      occurrences.push(formatDateUtc(start));
    }
    return occurrences;
  }

  let cursor = start;
  while (cursor < clampStart) {
    if (repeatRule === "day") {
      cursor = addDays(cursor, 1);
    } else if (repeatRule === "week") {
      cursor = addDays(cursor, 7);
    } else if (repeatRule === "month") {
      cursor = addMonths(cursor, 1);
    } else if (repeatRule === "year") {
      cursor = addYears(cursor, 1);
    } else {
      break;
    }
  }

  while (cursor <= clampEnd) {
    occurrences.push(formatDateUtc(cursor));
    if (repeatRule === "day") {
      cursor = addDays(cursor, 1);
    } else if (repeatRule === "week") {
      cursor = addDays(cursor, 7);
    } else if (repeatRule === "month") {
      cursor = addMonths(cursor, 1);
    } else if (repeatRule === "year") {
      cursor = addYears(cursor, 1);
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

    const seriesResult = await pool.query(
      "select id, title, type, start_date, end_date, repeat_rule, status from chores where status = 'active'",
    );

    const overridesResult = await pool.query(
      "select chore_id, occurrence_date, status, closed_reason from chore_occurrence_overrides",
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

    const rangeStart = start ? new Date(start) : new Date();
    const rangeEnd = end ? new Date(end) : new Date();

    const chores = seriesResult.rows.flatMap((row) => {
      const seriesStart = normalizeDate(row.start_date);
      const seriesEnd = normalizeDate(row.end_date);
      if (!seriesStart || !seriesEnd) {
        return [];
      }
      const occurrences = generateOccurrences(
        new Date(seriesStart),
        new Date(seriesEnd),
        rangeStart,
        rangeEnd,
        row.repeat_rule,
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
