import { DateTime } from "luxon";
import { API_ERROR_CODE, type ApiErrorCode } from "@/lib/api-error";
import { type ChorePatchPayload, validateChorePatchIntent } from "@/lib/api-payload-validation";
import { getStoredChoreDurationDays } from "@/lib/chore-date-range";
import {
  ChoreDateValidationError,
  getChoreDateSpanErrors,
  getChorePatchDateErrors,
  getChoreQueryInputErrors,
  getChoreQueryRangeErrors,
  isValidChoreDateKey,
  MAX_CHORE_EXCEPTION_MIGRATIONS,
  MAX_CHORE_GENERATED_ENTRIES,
  MAX_CHORE_GENERATION_STEPS,
  MAX_CHORE_QUERY_ROWS,
  MAX_CHORE_WEEK_OFFSET,
  normalizeChoreDate as normalizeDate,
} from "@/lib/chore-date-validation";
import { translateOccurrenceSeriesDates } from "@/lib/chore-edit-dates";
import type { ChoreMutationData, ChoreMutationFailure } from "@/lib/chore-mutation-response";
import { normalizeChoreNotes as normalizeNotes } from "@/lib/chore-notes";
import { normalizeRepeatRule, validateChoreCreate } from "@/lib/chore-validation";
import { withHouseholdMutationLock } from "@/lib/household-mutation-lock";
import { canManageHouseholdChores } from "@/lib/household-roles";
import type { RepeatRule } from "@/lib/occurrences";
import {
  generateOccurrenceDayEntries,
  isOccurrenceStartInSeries,
  mapOccurrenceStarts,
  OccurrenceLimitExceededError,
} from "@/lib/occurrences";
import {
  deleteChoreOccurrenceException,
  deleteChoreOccurrenceExceptions,
  getChoreInHousehold,
  getChoreOccurrenceException,
  getHouseholdSummaryForUser,
  getHouseholdTimeZoneById,
  insertChore,
  listActiveChoreSeriesByHousehold,
  listChoreExceptionsByHousehold,
  listChoreOccurrenceExceptions,
  updateChoreSeries,
  updateChoreSeriesEndDate,
  updateChoreStatus,
  upsertChoreOccurrenceException,
} from "@/lib/repositories";

type ChoreMutationScope = "single" | "following" | "all";

type ChoreMutationSuccess = {
  ok: true;
  data: ChoreMutationData;
};

const choreMutationFailure = ({
  code,
  error,
  fieldErrors,
}: {
  code: ApiErrorCode;
  error: string;
  fieldErrors?: Record<string, string>;
}): ChoreMutationFailure => ({
  ok: false,
  code,
  error,
  ...(fieldErrors ? { fieldErrors } : {}),
});

const generationBudget = (remainingEntries = MAX_CHORE_GENERATED_ENTRIES) => ({
  remainingEntries,
  remainingSteps: MAX_CHORE_GENERATION_STEPS,
});

const addDays = (value: string, days: number) =>
  DateTime.fromISO(value, { zone: "UTC" }).plus({ days }).toISODate();

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
  const inputErrors = getChoreQueryInputErrors(start, end);
  if (
    start === null &&
    end === null &&
    (!Number.isSafeInteger(weekOffset) || Math.abs(weekOffset) > MAX_CHORE_WEEK_OFFSET)
  )
    inputErrors.weekOffset = `Week offset must be an integer between -${MAX_CHORE_WEEK_OFFSET} and ${MAX_CHORE_WEEK_OFFSET}`;
  if (Object.keys(inputErrors).length) throw new ChoreDateValidationError(inputErrors);
  const timeZone = await getHouseholdTimeZoneById(householdId);
  let rangeStart: string;
  let rangeEnd: string;
  if (start === null && end === null) {
    const today = DateTime.now().setZone(timeZone).startOf("day");
    if (!today.isValid) throw new Error("Invalid household timezone");
    const defaultWeekStart = today.minus({ days: today.weekday - 1 }).plus({ weeks: weekOffset });
    rangeStart = defaultWeekStart.toISODate() ?? "";
    rangeEnd = defaultWeekStart.plus({ days: 6 }).toISODate() ?? "";
  } else {
    rangeStart = normalizeDate(start, timeZone) ?? "";
    rangeEnd = normalizeDate(end, timeZone) ?? "";
  }
  const rangeErrors = getChoreQueryRangeErrors(rangeStart, rangeEnd);
  if (Object.keys(rangeErrors).length) throw new ChoreDateValidationError(rangeErrors);

  const [seriesRows, exceptionRows] = await Promise.all([
    listActiveChoreSeriesByHousehold({
      householdId,
      rangeStart,
      rangeEnd,
      maxResults: MAX_CHORE_QUERY_ROWS + 1,
    }),
    listChoreExceptionsByHousehold({
      householdId,
      rangeStart,
      rangeEnd,
      maxResults: MAX_CHORE_QUERY_ROWS + 1,
    }),
  ]);
  if (seriesRows.length > MAX_CHORE_QUERY_ROWS || exceptionRows.length > MAX_CHORE_QUERY_ROWS)
    throw new ChoreDateValidationError({
      range: `Date range exceeds the ${MAX_CHORE_QUERY_ROWS}-row selection limit`,
    });
  const budget = generationBudget();

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
    const rowStartDate = normalizeDate(row.start_date, timeZone);
    const rowEndDate = normalizeDate(row.end_date, timeZone);
    if (!rowStartDate || !rowEndDate) {
      return [];
    }
    let occurrenceDayEntries: ReturnType<typeof generateOccurrenceDayEntries>;
    try {
      occurrenceDayEntries = generateOccurrenceDayEntries({
        startDate: rowStartDate,
        endDate: rowEndDate,
        rangeStart,
        rangeEnd,
        repeatRule: normalizeRepeatRule(row.repeat_rule) as RepeatRule,
        seriesEndDate: normalizeDate(row.series_end_date, timeZone),
        timeZone,
        budget,
        anchorDay: row.recurrence_anchor_day,
      });
    } catch (error) {
      if (!(error instanceof OccurrenceLimitExceededError)) throw error;
      throw new ChoreDateValidationError({
        range:
          error.kind === "entries"
            ? `Date range exceeds ${MAX_CHORE_GENERATED_ENTRIES} generated day entries`
            : `Date range exceeds ${MAX_CHORE_GENERATION_STEPS} recurrence steps`,
      });
    }

    return occurrenceDayEntries
      .filter((occurrenceDayEntry) => {
        const exception = exceptions.get(`${row.id}:${occurrenceDayEntry.occurrenceStartDate}`);
        return exception?.kind !== "canceled";
      })
      .map((occurrenceDayEntry) => {
        const exceptionKey = `${row.id}:${occurrenceDayEntry.occurrenceStartDate}`;
        const exception = exceptions.get(exceptionKey);

        return {
          id: row.id,
          title: row.title,
          type: row.type,
          is_repeating: normalizeRepeatRule(row.repeat_rule) !== "none",
          series_start_date: rowStartDate,
          repeat_rule: normalizeRepeatRule(row.repeat_rule),
          series_end_date: normalizeDate(row.series_end_date, timeZone),
          duration_days: getStoredChoreDurationDays({
            startDate: rowStartDate,
            exclusiveEndDate: rowEndDate,
          }),
          notes: row.notes ?? null,
          status: exception?.kind === "state" ? (exception.status ?? "open") : "open",
          closed_reason: exception?.kind === "state" ? (exception.closed_reason ?? null) : null,
          occurrence_date: occurrenceDayEntry.occurrenceDay,
          occurrence_start_date: occurrenceDayEntry.occurrenceStartDate,
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

type ChoreMutationInput = {
  householdId: number;
  payload: ChorePatchPayload;
  actorUserId?: number;
};

const mutateChoreInTransaction = async ({
  householdId,
  payload,
  actorUserId,
}: ChoreMutationInput): Promise<ChoreMutationSuccess | ChoreMutationFailure> => {
  const input = payload;
  const intentValidationError = validateChorePatchIntent(input);
  if (intentValidationError) {
    return choreMutationFailure({
      code:
        intentValidationError.path === "action"
          ? API_ERROR_CODE.ACTION_INVALID
          : intentValidationError.path === "status"
            ? API_ERROR_CODE.STATUS_INVALID
            : API_ERROR_CODE.CANCEL_SCOPE_INVALID,
      error: intentValidationError.message,
    });
  }

  const action = input.action ?? "set";
  if (actorUserId !== undefined) {
    const access = await getHouseholdSummaryForUser({ householdId, userId: actorUserId });
    if (!access || (action !== "set" && !canManageHouseholdChores(access))) {
      return choreMutationFailure({
        code: API_ERROR_CODE.FORBIDDEN,
        error: "Household chore access changed. Please reload.",
      });
    }
  }
  const inputDateErrors = getChorePatchDateErrors(input);
  if (Object.keys(inputDateErrors).length)
    return choreMutationFailure({
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Validation failed",
      fieldErrors: inputDateErrors,
    });
  const timeZone =
    action === "create" || action === "edit" ? await getHouseholdTimeZoneById(householdId) : "UTC";
  const localDateErrors = getChorePatchDateErrors(input, timeZone);
  if (Object.keys(localDateErrors).length)
    return choreMutationFailure({
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Validation failed",
      fieldErrors: localDateErrors,
    });
  const budget = generationBudget(MAX_CHORE_EXCEPTION_MIGRATIONS);
  const rawStatus = input.status ?? null;
  const rawScope = input.scope ?? null;

  const choreId = Number(input.choreId);
  const occurrenceStartDate = normalizeDate(input.occurrenceStartDate, "UTC");
  const status = rawStatus === "closed" ? "closed" : "open";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const inputType =
    input.type === undefined
      ? undefined
      : typeof input.type === "string"
        ? input.type.trim().toLowerCase()
        : "";
  const startDate = normalizeDate(input.startDate, timeZone);
  const exclusiveEndDate = normalizeDate(input.endDate, timeZone);
  const seriesEndDate = normalizeDate(input.seriesEndDate, timeZone);
  if (action === "create" || action === "edit") {
    const spanErrors = getChoreDateSpanErrors(startDate, exclusiveEndDate);
    if (Object.keys(spanErrors).length)
      return choreMutationFailure({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Validation failed",
        fieldErrors: spanErrors,
      });
  }
  const repeatRule =
    typeof input.repeatRule === "string" ? normalizeRepeatRule(input.repeatRule) : "none";
  const notes = normalizeNotes(input.notes);
  const scope = rawScope as ChoreMutationScope | null;

  if (action === "create") {
    const createType = inputType ?? "close_on_done";
    const fieldErrors = validateChoreCreate({
      title,
      type: createType,
      startDate,
      exclusiveEndDate,
      repeatRule,
      seriesEndDate,
    });

    if (Object.keys(fieldErrors).length) {
      return choreMutationFailure({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Validation failed",
        fieldErrors,
      });
    }

    const type = createType === "stay_open" ? "stay_open" : "close_on_done";

    const choreIdCreated = await insertChore({
      householdId,
      title,
      type,
      startDate,
      endDate: exclusiveEndDate,
      seriesEndDate,
      repeatRule,
      notes,
    });

    return {
      ok: true,
      data: {
        choreId: choreIdCreated,
        title,
        startDate,
        endDate: exclusiveEndDate,
        seriesEndDate,
        repeatRule,
        type,
        notes,
      },
    };
  }

  if (!choreId || !occurrenceStartDate) {
    return choreMutationFailure({
      code: API_ERROR_CODE.MISSING_CHORE_OCCURRENCE,
      error: "Missing choreId or occurrenceStartDate",
    });
  }

  const chore = await getChoreInHousehold({ choreId, householdId });
  if (!chore) {
    return choreMutationFailure({
      code: API_ERROR_CODE.CHORE_NOT_FOUND,
      error: "Chore not found",
    });
  }

  const occurrenceInSeries = isOccurrenceStartInSeries({
    occurrenceStartDate,
    repeatRule: normalizeRepeatRule(chore.repeat_rule) as RepeatRule,
    seriesEndDate: chore.series_end_date,
    startDate: chore.start_date,
    endDate: chore.end_date,
    budget,
    anchorDay: chore.recurrence_anchor_day,
  });

  if (!occurrenceInSeries) {
    return choreMutationFailure({
      code: API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE,
      error: "Occurrence start date is outside chore schedule",
    });
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
    return choreMutationFailure({
      code: API_ERROR_CODE.OCCURRENCE_CANCELED,
      error: "Occurrence is canceled",
    });
  }

  const choreType = chore.type === "stay_open" ? "stay_open" : "close_on_done";
  const choreRepeatRule = normalizeRepeatRule(chore.repeat_rule);

  if (action === "edit") {
    if (
      input.dateBasis !== undefined &&
      input.dateBasis !== "series" &&
      input.dateBasis !== "occurrence"
    ) {
      return choreMutationFailure({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Validation failed",
        fieldErrors: { dateBasis: "Date basis must be series or occurrence" },
      });
    }
    const editScope = scope as ChoreMutationScope;
    const treatFollowingAsAll =
      editScope === "following" && occurrenceStartDate === chore.start_date;
    const originalDurationDays = getStoredChoreDurationDays({
      startDate: chore.start_date,
      exclusiveEndDate: chore.end_date,
    });
    const useWholeSeriesDefaults = editScope === "all" || treatFollowingAsAll;
    const defaultStartDate = useWholeSeriesDefaults ? chore.start_date : occurrenceStartDate;
    let nextStartDate = normalizeDate(input.startDate, timeZone) ?? defaultStartDate;
    let nextExclusiveEndDate =
      normalizeDate(input.endDate, timeZone) ??
      addDays(nextStartDate, originalDurationDays) ??
      nextStartDate;
    if (useWholeSeriesDefaults && input.dateBasis === "occurrence") {
      const occurrenceStartInput = Object.hasOwn(input, "startDate")
        ? normalizeDate(input.startDate, timeZone)
        : occurrenceStartDate;
      const occurrenceEndInput = Object.hasOwn(input, "endDate")
        ? normalizeDate(input.endDate, timeZone)
        : occurrenceStartInput
          ? addDays(occurrenceStartInput, originalDurationDays)
          : null;
      const translated = translateOccurrenceSeriesDates({
        seriesStartDate: chore.start_date,
        occurrenceStartDate,
        startDate: occurrenceStartInput,
        exclusiveEndDate: occurrenceEndInput,
      });
      if (!translated.ok)
        return choreMutationFailure({
          code: API_ERROR_CODE.VALIDATION_FAILED,
          error: "Validation failed",
          fieldErrors: translated.fieldErrors,
        });
      nextStartDate = translated.startDate;
      nextExclusiveEndDate = translated.exclusiveEndDate;
    }
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
    const nextType = inputType ?? choreType;
    const nextNotes = typeof input.notes === "string" ? notes : (chore.notes ?? null);
    // A split at a clamped instance must not turn an unchanged Jan-31 chain into a 28th chain.
    const nextAnchorDay =
      (nextRepeatRule === "month" || nextRepeatRule === "year") &&
      nextRepeatRule === choreRepeatRule &&
      nextStartDate === defaultStartDate
        ? (chore.recurrence_anchor_day ?? DateTime.fromISO(chore.start_date, { zone: "UTC" }).day)
        : null;

    const fieldErrors = validateChoreCreate({
      title: nextTitle,
      type: nextType,
      startDate: nextStartDate,
      exclusiveEndDate: nextExclusiveEndDate,
      repeatRule: nextRepeatRule,
      seriesEndDate: nextSeriesEndDate,
    });

    if (Object.keys(fieldErrors).length) {
      return choreMutationFailure({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Validation failed",
        fieldErrors,
      });
    }

    if (editScope === "following" && choreRepeatRule === "none") {
      return choreMutationFailure({
        code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
        error: "scope following requires a repeating chore",
      });
    }

    const exceptionFromDate = useWholeSeriesDefaults ? "0001-01-01" : occurrenceStartDate;
    const migrateExceptions = async (targetChoreId: number) => {
      const rows = await listChoreOccurrenceExceptions({
        choreId,
        fromDate: exceptionFromDate,
        maxResults: MAX_CHORE_EXCEPTION_MIGRATIONS + 1,
      });
      if (rows.length > MAX_CHORE_EXCEPTION_MIGRATIONS)
        throw new OccurrenceLimitExceededError("entries");
      if (rows.some((row) => !isValidChoreDateKey(row.occurrence_start_date)))
        throw new ChoreDateValidationError({
          scope: "Edit includes occurrence exceptions outside supported calendar years",
        });
      const mapping = mapOccurrenceStarts({
        occurrenceStarts: rows.map((row) => row.occurrence_start_date),
        sourceStartDate: chore.start_date,
        sourceRepeatRule: choreRepeatRule as RepeatRule,
        sourceSeriesEndDate: chore.series_end_date,
        fromDate: useWholeSeriesDefaults ? chore.start_date : occurrenceStartDate,
        targetStartDate: nextStartDate,
        targetRepeatRule: nextRepeatRule as RepeatRule,
        targetSeriesEndDate: nextSeriesEndDate,
        budget,
        sourceAnchorDay: chore.recurrence_anchor_day,
        targetAnchorDay: nextAnchorDay,
      });
      if ([...mapping.values()].some((date) => !isValidChoreDateKey(date)))
        throw new ChoreDateValidationError({
          repeatRule: "Edited recurrence moves exceptions outside supported calendar years",
        });
      // Clear every old key first: a shifted target may occupy another source key.
      await deleteChoreOccurrenceExceptions({ choreId, fromDate: exceptionFromDate });
      for (const row of rows) {
        const mappedDate = mapping.get(row.occurrence_start_date);
        if (!mappedDate) continue;
        await upsertChoreOccurrenceException({
          choreId: targetChoreId,
          occurrenceStartDate: mappedDate,
          kind: row.kind === "canceled" ? "canceled" : "state",
          status: row.status === "closed" ? "closed" : row.status === "open" ? "open" : null,
          closedReason: row.closed_reason === "done" ? "done" : null,
        });
      }
    };

    if (editScope === "all" || treatFollowingAsAll) {
      await updateChoreSeries({
        choreId,
        title: nextTitle,
        type: nextType,
        startDate: nextStartDate,
        endDate: nextExclusiveEndDate,
        seriesEndDate: nextSeriesEndDate,
        repeatRule: nextRepeatRule,
        notes: nextNotes,
        recurrenceAnchorDay: nextAnchorDay,
      });

      await migrateExceptions(choreId);

      return {
        ok: true,
        data: {
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
      endDate: nextExclusiveEndDate,
      seriesEndDate: nextSeriesEndDate,
      repeatRule: nextRepeatRule,
      notes: nextNotes,
      recurrenceAnchorDay: nextAnchorDay,
    });

    if (editScope === "following") {
      await migrateExceptions(createdChoreId);
    } else if (completionException) {
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
      data: {
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
      return choreMutationFailure({
        code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
        error: "scope following requires a repeating chore",
      });
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
      data: {
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
    data: {
      choreId,
      occurrenceStartDate,
      type: choreType,
      status: overrideStatus,
      closed_reason: closedReason,
    },
  };
};

/** All writers share one household transaction so edits cannot interleave with completion/cancellation. */
export const mutateChore = async (
  input: ChoreMutationInput,
): Promise<ChoreMutationSuccess | ChoreMutationFailure> => {
  try {
    return await withHouseholdMutationLock({
      householdId: input.householdId,
      task: () => mutateChoreInTransaction(input),
    });
  } catch (error) {
    if (error instanceof ChoreDateValidationError)
      return choreMutationFailure({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: error.message,
        fieldErrors: error.fieldErrors,
      });
    if (!(error instanceof OccurrenceLimitExceededError)) throw error;
    // Convert only after the transaction rolls back: migration may already have updated its source.
    const message =
      error.kind === "entries"
        ? `Edit may affect at most ${MAX_CHORE_EXCEPTION_MIGRATIONS} occurrence exceptions`
        : `Chore operation exceeds ${MAX_CHORE_GENERATION_STEPS} recurrence steps`;
    return choreMutationFailure({
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: message,
      fieldErrors: { [input.payload.action === "edit" ? "scope" : "occurrenceStartDate"]: message },
    });
  }
};
