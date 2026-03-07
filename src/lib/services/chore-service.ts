import { DateTime } from "luxon";
import { API_ERROR_CODE, apiErrorBody } from "@/lib/api-error";
import { CHORE_UNDO_WINDOW_SECONDS } from "@/lib/chore-undo";
import { normalizeRepeatRule, validateChoreCreate } from "@/lib/chore-validation";
import { toISODateOrThrow } from "@/lib/date";
import type { RepeatRule } from "@/lib/occurrences";
import { generateOccurrenceInstances } from "@/lib/occurrences";
import {
  deleteChoreOccurrenceOverride,
  getChoreInHousehold,
  getChoreOccurrenceExclusion,
  getChoreOccurrenceOverride,
  getHouseholdTimeZoneById,
  insertChore,
  listActiveChoreSeriesByHousehold,
  listChoreExclusionsByHousehold,
  listChoreOverridesByHousehold,
  updateChoreSeriesEndDate,
  upsertChoreOccurrenceExclusion,
  upsertChoreOccurrenceOverride,
} from "@/lib/repositories";

const toDateString = (value: string | null, timeZone: string) => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = DateTime.fromISO(value, { zone: timeZone });
  return parsed.isValid ? parsed.toISODate() : null;
};

const normalizeDate = (value: unknown, timeZone: string) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = DateTime.fromISO(value, { zone: timeZone });
    return parsed.isValid ? parsed.toISODate() : null;
  }
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: timeZone });
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

const isOccurrenceStartInSeries = ({
  occurrenceStartDate,
  repeatRule,
  seriesEndDate,
  startDate,
  endDate,
}: {
  occurrenceStartDate: string;
  repeatRule: string;
  seriesEndDate: string | null;
  startDate: string;
  endDate: string;
}) =>
  generateOccurrenceInstances({
    startDate,
    endDate,
    rangeStart: occurrenceStartDate,
    rangeEnd: occurrenceStartDate,
    repeatRule: normalizeRepeatRule(repeatRule) as RepeatRule,
    seriesEndDate,
    timeZone: "UTC",
  }).some((instance) => instance.occurrenceStartDate === occurrenceStartDate);

export const listChores = async ({
  householdId,
  weekOffset,
  start,
  end,
}: {
  householdId: number;
  weekOffset: number;
  start: string | null;
  end: string | null;
}) => {
  const timeZone = await getHouseholdTimeZoneById(householdId);
  const rangeStartInput = toDateString(start, timeZone);
  const rangeEndInput = toDateString(end, timeZone);

  const today = DateTime.now().setZone(timeZone).startOf("day");
  const defaultWeekStart = today.minus({ days: today.weekday - 1 }).plus({ weeks: weekOffset });
  const defaultWeekEnd = defaultWeekStart.plus({ days: 6 });
  const rangeStart = rangeStartInput ?? defaultWeekStart.toISODate() ?? "";
  const rangeEnd = rangeEndInput ?? defaultWeekEnd.toISODate() ?? "";

  const [seriesRows, overrideRows, exclusionRows] = await Promise.all([
    listActiveChoreSeriesByHousehold({ householdId, rangeStart, rangeEnd }),
    listChoreOverridesByHousehold({ householdId, rangeStart, rangeEnd }),
    listChoreExclusionsByHousehold({ householdId, rangeStart, rangeEnd }),
  ]);

  const overrides = new Map<
    string,
    { status: string; closed_reason: string | null; undo_until: string | null }
  >();

  for (const row of overrideRows) {
    const occurrenceStartDate = normalizeDate(row.occurrence_start_date, timeZone);
    if (!occurrenceStartDate) {
      continue;
    }
    const undoUntil = row.undo_until ? DateTime.fromJSDate(row.undo_until).toUTC().toISO() : null;
    overrides.set(`${row.chore_id}:${occurrenceStartDate}`, {
      status: row.status,
      closed_reason: row.closed_reason ?? null,
      undo_until: undoUntil,
    });
  }

  const exclusions = new Set<string>();
  for (const row of exclusionRows) {
    const occurrenceStartDate = normalizeDate(row.occurrence_start_date, timeZone);
    if (!occurrenceStartDate) {
      continue;
    }
    exclusions.add(`${row.chore_id}:${occurrenceStartDate}`);
  }

  const chores = seriesRows.flatMap((row) => {
    const seriesStart = normalizeDate(row.start_date, timeZone);
    const occurrenceEnd = normalizeDate(row.end_date, timeZone);
    if (!seriesStart || !occurrenceEnd) {
      return [];
    }
    const occurrences = generateOccurrenceInstances({
      startDate: seriesStart,
      endDate: occurrenceEnd,
      rangeStart,
      rangeEnd,
      repeatRule: normalizeRepeatRule(row.repeat_rule) as RepeatRule,
      seriesEndDate: normalizeDate(row.series_end_date, timeZone),
      timeZone,
    });

    return occurrences
      .filter((occurrence) => !exclusions.has(`${row.id}:${occurrence.occurrenceStartDate}`))
      .map((occurrence) => {
        const overrideKey = `${row.id}:${occurrence.occurrenceStartDate}`;
        const override = overrides.get(overrideKey);
        const nowUtc = DateTime.utc();
        const undoUntil = override?.undo_until ? DateTime.fromISO(override.undo_until) : null;
        const isUndoWindowActive =
          override?.closed_reason === "done" && !!undoUntil && undoUntil > nowUtc;

        return {
          id: row.id,
          title: row.title,
          type: row.type,
          notes: row.notes ?? null,
          status: override?.status ?? "open",
          closed_reason: override?.closed_reason ?? null,
          occurrence_date: occurrence.occurrenceDay,
          occurrence_start_date: occurrence.occurrenceStartDate,
          undo_until: override?.undo_until ?? null,
          can_undo: isUndoWindowActive,
        };
      });
  });

  return {
    timeZone,
    rangeStart,
    rangeEnd,
    chores,
  };
};

type ChoreMutationFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

type ChoreMutationSuccess = {
  ok: true;
  body: Record<string, unknown>;
};

export const mutateChore = async ({
  householdId,
  payload,
}: {
  householdId: number;
  payload: unknown;
}): Promise<ChoreMutationSuccess | ChoreMutationFailure> => {
  const input = (payload ?? {}) as Record<string, unknown>;
  const rawAction = typeof input.action === "string" ? input.action.trim().toLowerCase() : null;
  const action = rawAction ?? "set";

  if (action !== "create" && action !== "set" && action !== "undo" && action !== "cancel") {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.ACTION_INVALID,
          error: "Action must be create, set, undo, or cancel",
        }),
      },
    };
  }

  const rawStatus = typeof input.status === "string" ? input.status.trim().toLowerCase() : null;
  const rawCancelScope =
    typeof input.cancelScope === "string" ? input.cancelScope.trim().toLowerCase() : null;
  if (action === "set" && rawStatus !== "open" && rawStatus !== "closed") {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.STATUS_INVALID,
          error: "Status must be open or closed",
        }),
      },
    };
  }

  if (action === "cancel" && rawCancelScope !== "single" && rawCancelScope !== "following") {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
          error: "cancelScope must be single or following",
        }),
      },
    };
  }

  const choreId = Number(input.choreId);
  const occurrenceStartDate = normalizeDate(input.occurrenceStartDate, "UTC");
  const status = rawStatus === "closed" ? "closed" : "open";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const inputType =
    typeof input.type === "string" ? input.type.trim().toLowerCase() : "close_on_done";
  let startDate = normalizeDate(input.startDate, "UTC");
  let endDate = normalizeDate(input.endDate, "UTC");
  let seriesEndDate = normalizeDate(input.seriesEndDate, "UTC");
  const repeatRule =
    typeof input.repeatRule === "string" ? normalizeRepeatRule(input.repeatRule) : "none";
  const notes = normalizeNotes(input.notes);

  if (action === "create") {
    const timeZone = await getHouseholdTimeZoneById(householdId);
    const today = toISODateOrThrow(DateTime.now().setZone(timeZone));
    const startDateLocal = normalizeDate(input.startDate, timeZone);
    const endDateLocal = normalizeDate(input.endDate, timeZone);
    const seriesEndDateLocal = normalizeDate(input.seriesEndDate, timeZone);
    startDate = startDateLocal;
    endDate = endDateLocal;
    seriesEndDate = seriesEndDateLocal;

    const fieldErrors = validateChoreCreate({
      title,
      type: inputType,
      startDate: startDateLocal,
      endDate: endDateLocal,
      repeatRule,
      seriesEndDate: seriesEndDateLocal,
      today,
    });

    if (Object.keys(fieldErrors).length) {
      return {
        ok: false,
        status: 400,
        body: apiErrorBody({
          code: API_ERROR_CODE.VALIDATION_FAILED,
          error: "Validation failed",
          fieldErrors,
        }),
      };
    }

    const type = inputType === "stay_open" ? "stay_open" : "close_on_done";

    const choreIdCreated = await insertChore({
      householdId,
      title,
      type,
      startDate,
      endDate,
      seriesEndDate,
      repeatRule,
      notes,
    });

    return {
      ok: true,
      body: {
        ok: true,
        choreId: choreIdCreated,
        title,
        startDate,
        endDate,
        seriesEndDate,
        repeatRule,
        type,
        notes,
      },
    };
  }

  if (!choreId || !occurrenceStartDate) {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.MISSING_CHORE_OCCURRENCE,
          error: "Missing choreId or occurrenceStartDate",
        }),
      },
    };
  }

  const chore = await getChoreInHousehold({ choreId, householdId });
  if (!chore) {
    return {
      ok: false,
      status: 404,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.CHORE_NOT_FOUND,
          error: "Chore not found",
        }),
      },
    };
  }

  const occurrenceInSeries = isOccurrenceStartInSeries({
    occurrenceStartDate,
    repeatRule: chore.repeat_rule,
    seriesEndDate: chore.series_end_date,
    startDate: chore.start_date,
    endDate: chore.end_date,
  });

  if (!occurrenceInSeries) {
    return {
      ok: false,
      status: 409,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE,
          error: "Occurrence start date is outside chore schedule",
        }),
      },
    };
  }

  const exclusion = await getChoreOccurrenceExclusion({
    choreId,
    occurrenceStartDate,
  });

  if (action !== "cancel" && exclusion) {
    return {
      ok: false,
      status: 409,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.OCCURRENCE_CANCELED,
          error: "Occurrence is canceled",
        }),
      },
    };
  }

  const choreType = chore.type === "stay_open" ? "stay_open" : "close_on_done";
  const choreRepeatRule = normalizeRepeatRule(chore.repeat_rule);

  if (action === "cancel") {
    const cancelScope = rawCancelScope;

    if (cancelScope === "following" && choreRepeatRule === "none") {
      return {
        ok: false,
        status: 409,
        body: {
          ...apiErrorBody({
            code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
            error: "cancelScope following requires a repeating chore",
          }),
        },
      };
    }

    if (cancelScope === "following") {
      const nextSeriesEndDate = DateTime.fromISO(occurrenceStartDate, { zone: "UTC" })
        .minus({ days: 1 })
        .toISODate();
      await updateChoreSeriesEndDate({
        choreId,
        seriesEndDate: nextSeriesEndDate,
      });
    } else {
      await upsertChoreOccurrenceExclusion({
        choreId,
        occurrenceStartDate,
      });
      await deleteChoreOccurrenceOverride({
        choreId,
        occurrenceStartDate,
      });
    }

    return {
      ok: true,
      body: {
        ok: true,
        choreId,
        occurrenceStartDate,
        cancelScope,
      },
    };
  }

  const shouldRecordCompletion = status === "closed";
  const closedReason = shouldRecordCompletion ? "done" : null;
  const undoUntil = shouldRecordCompletion
    ? DateTime.utc().plus({ seconds: CHORE_UNDO_WINDOW_SECONDS }).toISO()
    : null;
  const overrideStatus = shouldRecordCompletion
    ? choreType === "stay_open"
      ? "open"
      : "closed"
    : "open";

  if (action === "undo") {
    const override = await getChoreOccurrenceOverride({ choreId, occurrenceStartDate });
    const undoUntil = override?.undoUntil ? DateTime.fromJSDate(override.undoUntil).toUTC() : null;

    if (
      !override ||
      override.closedReason !== "done" ||
      !undoUntil ||
      !undoUntil.isValid ||
      undoUntil <= DateTime.utc()
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          ...apiErrorBody({
            code: API_ERROR_CODE.UNDO_WINDOW_EXPIRED,
            error: "Undo window expired",
          }),
        },
      };
    }

    await deleteChoreOccurrenceOverride({ choreId, occurrenceStartDate });
  } else {
    await upsertChoreOccurrenceOverride({
      choreId,
      occurrenceStartDate,
      status: overrideStatus,
      closedReason,
      undoUntil,
    });
  }

  return {
    ok: true,
    body: {
      ok: true,
      choreId,
      occurrenceStartDate,
      type: choreType,
      status: overrideStatus,
      closed_reason: closedReason,
      undo_until: undoUntil,
    },
  };
};
