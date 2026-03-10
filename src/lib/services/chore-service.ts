import { DateTime } from "luxon";
import { API_ERROR_CODE, apiErrorBody } from "@/lib/api-error";
import { normalizeRepeatRule, validateChoreCreate } from "@/lib/chore-validation";
import type { RepeatRule } from "@/lib/occurrences";
import { generateOccurrenceInstances } from "@/lib/occurrences";
import {
  deleteChoreOccurrenceException,
  getChoreInHousehold,
  getChoreOccurrenceException,
  getHouseholdTimeZoneById,
  insertChore,
  listActiveChoreSeriesByHousehold,
  listChoreExceptionsByHousehold,
  updateChoreSeries,
  updateChoreSeriesEndDate,
  updateChoreStatus,
  upsertChoreOccurrenceException,
} from "@/lib/repositories";

type ChoreMutationScope = "single" | "following" | "all";

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

const addDays = (value: string, days: number) =>
  DateTime.fromISO(value, { zone: "UTC" }).plus({ days }).toISODate();

const spanDaysBetween = (startDate: string, endDate: string) => {
  const start = DateTime.fromISO(startDate, { zone: "UTC" }).startOf("day");
  const end = DateTime.fromISO(endDate, { zone: "UTC" }).startOf("day");
  return Math.max(Math.round(end.diff(start, "days").days), 1);
};

const dayOffsetBetween = (startDate: string, endDate: string) => {
  const start = DateTime.fromISO(startDate, { zone: "UTC" }).startOf("day");
  const end = DateTime.fromISO(endDate, { zone: "UTC" }).startOf("day");
  return Math.round(end.diff(start, "days").days);
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

  const [seriesRows, exceptionRows] = await Promise.all([
    listActiveChoreSeriesByHousehold({ householdId, rangeStart, rangeEnd }),
    listChoreExceptionsByHousehold({ householdId, rangeStart, rangeEnd }),
  ]);

  const exceptions = new Map<
    string,
    { kind: string; status: string | null; closed_reason: string | null }
  >();

  for (const row of exceptionRows) {
    const occurrenceStartDate = normalizeDate(row.occurrence_start_date, timeZone);
    if (!occurrenceStartDate) {
      continue;
    }
    exceptions.set(`${row.chore_id}:${occurrenceStartDate}`, {
      kind: row.kind,
      status: row.status,
      closed_reason: row.closed_reason ?? null,
    });
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
      .filter((occurrence) => {
        const exception = exceptions.get(`${row.id}:${occurrence.occurrenceStartDate}`);
        return exception?.kind !== "canceled";
      })
      .map((occurrence) => {
        const exceptionKey = `${row.id}:${occurrence.occurrenceStartDate}`;
        const exception = exceptions.get(exceptionKey);

        return {
          id: row.id,
          title: row.title,
          type: row.type,
          is_repeating: normalizeRepeatRule(row.repeat_rule) !== "none",
          series_start_date: seriesStart,
          repeat_rule: normalizeRepeatRule(row.repeat_rule),
          series_end_date: normalizeDate(row.series_end_date, timeZone),
          duration_days: spanDaysBetween(seriesStart, occurrenceEnd),
          notes: row.notes ?? null,
          status: exception?.kind === "state" ? (exception.status ?? "open") : "open",
          closed_reason: exception?.kind === "state" ? (exception.closed_reason ?? null) : null,
          occurrence_date: occurrence.occurrenceDay,
          occurrence_start_date: occurrence.occurrenceStartDate,
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

  if (action !== "create" && action !== "set" && action !== "cancel" && action !== "edit") {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.ACTION_INVALID,
          error: "Action must be create, set, cancel, or edit",
        }),
      },
    };
  }

  const rawStatus = typeof input.status === "string" ? input.status.trim().toLowerCase() : null;
  const rawScope = typeof input.scope === "string" ? input.scope.trim().toLowerCase() : null;
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

  if (
    (action === "cancel" || action === "edit") &&
    rawScope !== "single" &&
    rawScope !== "following" &&
    rawScope !== "all"
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        ...apiErrorBody({
          code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
          error: "scope must be single, following, or all",
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
  const scope = rawScope as ChoreMutationScope | null;

  if (action === "create") {
    const timeZone = await getHouseholdTimeZoneById(householdId);
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

  const exception = await getChoreOccurrenceException({
    choreId,
    occurrenceStartDate,
  });
  const completionException =
    exception?.kind === "state" && exception.closed_reason === "done"
      ? {
          status: (exception.status === "closed" ? "closed" : "open") as "open" | "closed",
          closedReason: "done" as const,
        }
      : null;

  if (action !== "cancel" && exception?.kind === "canceled") {
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

  if (action === "edit") {
    const editScope = scope as ChoreMutationScope;
    const treatFollowingAsAll =
      editScope === "following" && occurrenceStartDate === chore.start_date;
    const timeZone = await getHouseholdTimeZoneById(householdId);
    const originalSpanDays = spanDaysBetween(chore.start_date, chore.end_date);
    const useWholeSeriesDefaults = editScope === "all" || treatFollowingAsAll;
    const defaultStartDate = useWholeSeriesDefaults ? chore.start_date : occurrenceStartDate;
    const nextStartDate = normalizeDate(input.startDate, timeZone) ?? defaultStartDate;
    const nextEndDate =
      normalizeDate(input.endDate, timeZone) ??
      addDays(nextStartDate, originalSpanDays) ??
      nextStartDate;
    const nextRepeatRule =
      editScope === "single"
        ? "none"
        : typeof input.repeatRule === "string"
          ? normalizeRepeatRule(input.repeatRule)
          : choreRepeatRule;
    const hasSeriesEndDateInput = Object.hasOwn(input, "seriesEndDate");
    const nextSeriesEndDate =
      editScope === "single"
        ? null
        : hasSeriesEndDateInput
          ? input.seriesEndDate === null
            ? null
            : (normalizeDate(input.seriesEndDate, timeZone) ?? chore.series_end_date)
          : chore.series_end_date;
    const nextTitle = title || chore.title;
    const nextType =
      inputType === "stay_open" || inputType === "close_on_done" ? inputType : choreType;
    const nextNotes = typeof input.notes === "string" ? notes : (chore.notes ?? null);

    const fieldErrors = validateChoreCreate({
      title: nextTitle,
      type: nextType,
      startDate: nextStartDate,
      endDate: nextEndDate,
      repeatRule: nextRepeatRule,
      seriesEndDate: nextSeriesEndDate,
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

    if (editScope === "following" && choreRepeatRule === "none") {
      return {
        ok: false,
        status: 409,
        body: {
          ...apiErrorBody({
            code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
            error: "scope following requires a repeating chore",
          }),
        },
      };
    }

    if (editScope === "all" || treatFollowingAsAll) {
      const occurrenceShiftDays = dayOffsetBetween(chore.start_date, nextStartDate);
      const shiftedOccurrenceStartDate =
        addDays(occurrenceStartDate, occurrenceShiftDays) ?? nextStartDate;

      await updateChoreSeries({
        choreId,
        title: nextTitle,
        type: nextType,
        startDate: nextStartDate,
        endDate: nextEndDate,
        seriesEndDate: nextSeriesEndDate,
        repeatRule: nextRepeatRule,
        notes: nextNotes,
      });

      if (completionException && shiftedOccurrenceStartDate !== occurrenceStartDate) {
        await deleteChoreOccurrenceException({
          choreId,
          occurrenceStartDate,
        });
        await upsertChoreOccurrenceException({
          choreId,
          occurrenceStartDate: shiftedOccurrenceStartDate,
          kind: "state",
          status: completionException.status,
          closedReason: completionException.closedReason,
        });
      }

      return {
        ok: true,
        body: {
          ok: true,
          choreId,
          occurrenceStartDate,
          action,
          scope: editScope,
        },
      };
    }

    if (editScope === "following") {
      const previousSeriesEndDate = DateTime.fromISO(occurrenceStartDate, { zone: "UTC" })
        .minus({ days: 1 })
        .toISODate();
      await updateChoreSeriesEndDate({
        choreId,
        seriesEndDate: previousSeriesEndDate,
      });
    } else {
      await upsertChoreOccurrenceException({
        choreId,
        occurrenceStartDate,
        kind: "canceled",
        status: null,
        closedReason: null,
      });
    }

    const createdChoreId = await insertChore({
      householdId,
      title: nextTitle,
      type: nextType,
      startDate: nextStartDate,
      endDate: nextEndDate,
      seriesEndDate: nextSeriesEndDate,
      repeatRule: nextRepeatRule,
      notes: nextNotes,
    });

    if (createdChoreId && completionException) {
      await upsertChoreOccurrenceException({
        choreId: createdChoreId,
        occurrenceStartDate: nextStartDate,
        kind: "state",
        status: completionException.status,
        closedReason: completionException.closedReason,
      });
    }

    return {
      ok: true,
      body: {
        ok: true,
        choreId,
        createdChoreId,
        occurrenceStartDate,
        action,
        scope: editScope,
      },
    };
  }

  if (action === "cancel") {
    const cancelScope = scope as ChoreMutationScope;

    if (cancelScope === "following" && choreRepeatRule === "none") {
      return {
        ok: false,
        status: 409,
        body: {
          ...apiErrorBody({
            code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
            error: "scope following requires a repeating chore",
          }),
        },
      };
    }

    const treatFollowingAsAll =
      cancelScope === "following" && occurrenceStartDate === chore.start_date;

    if (cancelScope === "all" || treatFollowingAsAll) {
      await updateChoreStatus({
        choreId,
        status: "canceled",
      });
    } else if (cancelScope === "following") {
      const nextSeriesEndDate = DateTime.fromISO(occurrenceStartDate, { zone: "UTC" })
        .minus({ days: 1 })
        .toISODate();
      await updateChoreSeriesEndDate({
        choreId,
        seriesEndDate: nextSeriesEndDate,
      });
    } else {
      await upsertChoreOccurrenceException({
        choreId,
        occurrenceStartDate,
        kind: "canceled",
        status: null,
        closedReason: null,
      });
    }

    return {
      ok: true,
      body: {
        ok: true,
        choreId,
        occurrenceStartDate,
        scope: cancelScope,
      },
    };
  }

  const shouldRecordCompletion = status === "closed";
  const closedReason = shouldRecordCompletion ? "done" : null;
  const overrideStatus = shouldRecordCompletion
    ? choreType === "stay_open"
      ? "open"
      : "closed"
    : "open";

  if (!shouldRecordCompletion) {
    await deleteChoreOccurrenceException({ choreId, occurrenceStartDate });
  } else {
    await upsertChoreOccurrenceException({
      choreId,
      occurrenceStartDate,
      kind: "state",
      status: overrideStatus,
      closedReason,
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
    },
  };
};
