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

const normalizeNotes = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 500);
};

const allowedRepeatRules = new Set(["none", "day", "week", "biweek", "month", "year"]);

const normalizeRepeatRule = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "daily") return "day";
  if (normalized === "weekly") return "week";
  if (normalized === "biweekly") return "biweek";
  if (normalized === "monthly") return "month";
  if (normalized === "yearly") return "year";
  return normalized;
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
      "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, repeat_rule, status, notes from chores where status = 'active' and household_id = $1",
      [householdId],
    );

    const overridesResult = await pool.query(
      "select o.chore_id, to_char(o.occurrence_date, 'YYYY-MM-DD') as occurrence_date, o.status, o.closed_reason, o.undo_until from chore_occurrence_overrides o join chores c on c.id = o.chore_id where c.household_id = $1",
      [householdId],
    );

    const overrides = new Map<
      string,
      { status: string; closed_reason: string | null; undo_until: string | null }
    >();
    for (const row of overridesResult.rows) {
      const dateKey = normalizeDate(row.occurrence_date);
      if (!dateKey) {
        continue;
      }
      const undoUntil = row.undo_until ? DateTime.fromJSDate(row.undo_until).toUTC().toISO() : null;
      overrides.set(`${row.chore_id}:${dateKey}`, {
        status: row.status,
        closed_reason: row.closed_reason ?? null,
        undo_until: undoUntil,
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
        const nowUtc = DateTime.utc();
        const undoUntil = override?.undo_until ? DateTime.fromISO(override.undo_until) : null;
        const isUndoWindowActive =
          override?.status === "closed" &&
          override?.closed_reason === "done" &&
          !!undoUntil &&
          undoUntil > nowUtc;
        return {
          id: row.id,
          title: row.title,
          notes: row.notes ?? null,
          status: override?.status ?? "open",
          closed_reason: override?.closed_reason ?? null,
          occurrence_date: occurrenceDate,
          undo_until: override?.undo_until ?? null,
          can_undo: isUndoWindowActive,
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
    const action = typeof payload?.action === "string" ? payload.action : "set";
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const startDate = normalizeDate(payload?.startDate);
    const endDate = normalizeDate(payload?.endDate);
    const seriesEndDate = normalizeDate(payload?.seriesEndDate);
    const repeatRule =
      typeof payload?.repeatRule === "string" ? normalizeRepeatRule(payload.repeatRule) : "none";
    const notes = normalizeNotes(payload?.notes);
    const type = "close_on_done";

    if (action === "create") {
      const fieldErrors: Record<string, string> = {};

      if (!title) {
        fieldErrors.title = "Title is required";
      }
      if (!startDate) {
        fieldErrors.startDate = "Start date is required";
      }
      if (!endDate) {
        fieldErrors.endDate = "End date is required";
      }
      if (startDate && endDate && endDate < startDate) {
        fieldErrors.endDate = "End date must be on or after start date";
      }
      if (!allowedRepeatRules.has(repeatRule)) {
        fieldErrors.repeatRule = "Invalid repeat rule";
      }
      if (repeatRule === "none" && seriesEndDate) {
        fieldErrors.repeatEnd = "Repeat end is only allowed when repeating";
      }
      if (seriesEndDate && startDate && seriesEndDate < startDate) {
        fieldErrors.repeatEnd = "Repeat end must be on or after start date";
      }

      if (Object.keys(fieldErrors).length) {
        return Response.json(
          { ok: false, error: "Validation failed", fieldErrors },
          { status: 400 },
        );
      }

      const insertResult = await pool.query(
        "insert into chores (household_id, title, type, start_date, end_date, series_end_date, repeat_rule, status, notes) values ($1, $2, $3, $4, $5, $6, $7, 'active', $8) returning id",
        [1, title, type, startDate, endDate, seriesEndDate, repeatRule, notes],
      );

      return Response.json({
        ok: true,
        choreId: insertResult.rows[0]?.id,
        title,
        startDate,
        endDate,
        seriesEndDate,
        repeatRule,
        notes,
      });
    }

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
    const undoUntil = status === "closed" ? DateTime.utc().plus({ seconds: 5 }).toISO() : null;

    if (action === "undo") {
      await pool.query(
        "delete from chore_occurrence_overrides where chore_id = $1 and occurrence_date = $2",
        [choreId, occurrenceDate],
      );
    } else {
      await pool.query(
        "insert into chore_occurrence_overrides (chore_id, occurrence_date, status, closed_reason, undo_until) values ($1, $2, $3, $4, $5) on conflict (chore_id, occurrence_date) do update set status = excluded.status, closed_reason = excluded.closed_reason, undo_until = excluded.undo_until, updated_at = now()",
        [choreId, occurrenceDate, status, closedReason, undoUntil],
      );
    }

    return Response.json({
      ok: true,
      choreId,
      occurrenceDate,
      status,
      closed_reason: closedReason,
      undo_until: undoUntil,
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
