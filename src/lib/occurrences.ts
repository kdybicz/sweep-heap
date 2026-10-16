import { DateTime } from "luxon";

export type RepeatRule = "none" | "day" | "week" | "biweek" | "month" | "year";

export type OccurrenceGenerationBudget = { remainingEntries: number; remainingSteps: number };
export class OccurrenceLimitExceededError extends Error {
  readonly kind: "entries" | "steps";
  constructor(kind: "entries" | "steps") {
    super(`Occurrence ${kind} limit exceeded`);
    this.name = "OccurrenceLimitExceededError";
    this.kind = kind;
  }
}
const consumeStep = (budget?: OccurrenceGenerationBudget) => {
  if (!budget) return;
  if (budget.remainingSteps <= 0) throw new OccurrenceLimitExceededError("steps");
  budget.remainingSteps -= 1;
};
const consumeEntry = (budget?: OccurrenceGenerationBudget) => {
  if (!budget) return;
  if (budget.remainingEntries <= 0) throw new OccurrenceLimitExceededError("entries");
  budget.remainingEntries -= 1;
};

export type OccurrenceInput = {
  startDate: string;
  endDate: string;
  rangeStart: string;
  rangeEnd: string;
  repeatRule: RepeatRule;
  seriesEndDate?: string | null;
  timeZone: string;
  budget?: OccurrenceGenerationBudget;
};

export type OccurrenceDayEntry = {
  occurrenceDay: string;
  occurrenceStartDate: string;
};

const toDate = (value: string, timeZone: string) => {
  const parsed = DateTime.fromISO(value, { zone: timeZone });
  if (!parsed.isValid) return parsed;
  // Date-only values are civil dates, not instants. Use UTC calendar arithmetic so
  // skipped/repeated midnights cannot shift the cursor's hour or recurrence phase.
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? DateTime.fromISO(value, { zone: "UTC" })
    : parsed.setZone("UTC", { keepLocalTime: true }).startOf("day");
};

const fixedIntervalDays = (repeatRule: RepeatRule) =>
  repeatRule === "day" ? 1 : repeatRule === "week" ? 7 : repeatRule === "biweek" ? 14 : null;

const spanDaysFromDates = (start: DateTime, end: DateTime) =>
  Math.max(Math.round(end.diff(start, "days").days), 1);

const advance = <IsValid extends boolean>(
  value: DateTime<IsValid>,
  repeatRule: RepeatRule,
): DateTime<IsValid> => {
  if (repeatRule === "day") {
    return value.plus({ days: 1 });
  }
  if (repeatRule === "week") {
    return value.plus({ weeks: 1 });
  }
  if (repeatRule === "biweek") {
    return value.plus({ weeks: 2 });
  }
  if (repeatRule === "month") {
    return value.plus({ months: 1 });
  }
  if (repeatRule === "year") {
    return value.plus({ years: 1 });
  }
  return value;
};

/** Map sparse starts by ordinal using the same calendar stepping as board generation. */
export const mapOccurrenceStarts = ({
  occurrenceStarts,
  sourceStartDate,
  sourceRepeatRule,
  sourceSeriesEndDate,
  fromDate,
  targetStartDate,
  targetRepeatRule,
  targetSeriesEndDate,
  budget,
}: {
  occurrenceStarts: string[];
  sourceStartDate: string;
  sourceRepeatRule: RepeatRule;
  sourceSeriesEndDate: string | null;
  fromDate: string;
  targetStartDate: string;
  targetRepeatRule: RepeatRule;
  targetSeriesEndDate: string | null;
  budget?: OccurrenceGenerationBudget;
}) => {
  const mapping = new Map<string, string>();
  const wanted = new Set(occurrenceStarts);
  const last = [...wanted].sort().at(-1);
  if (!last) return mapping;
  let source: DateTime = toDate(sourceStartDate, "UTC");
  let target: DateTime = toDate(targetStartDate, "UTC");
  let targetAvailable = true;
  while (source.isValid) {
    consumeStep(budget);
    const sourceDate = source.toISODate();
    if (
      !sourceDate ||
      sourceDate > last ||
      (sourceSeriesEndDate && sourceDate > sourceSeriesEndDate)
    )
      break;
    if (sourceDate >= fromDate) {
      const targetDate = target.toISODate();
      if (
        !targetAvailable ||
        !targetDate ||
        (targetSeriesEndDate && targetDate > targetSeriesEndDate)
      )
        break;
      if (wanted.has(sourceDate)) {
        consumeEntry(budget);
        mapping.set(sourceDate, targetDate);
      }
      if (targetRepeatRule === "none") targetAvailable = false;
      else {
        consumeStep(budget);
        target = advance(target, targetRepeatRule);
      }
    }
    if (sourceRepeatRule === "none") break;
    const nextSource = advance(source, sourceRepeatRule);
    if (nextSource.equals(source)) break;
    source = nextSource;
  }
  return mapping;
};

export const generateOccurrenceDayKeys = ({
  startDate,
  endDate,
  rangeStart,
  rangeEnd,
  repeatRule,
  seriesEndDate,
  timeZone,
  budget,
}: OccurrenceInput) => {
  const dayEntries = generateOccurrenceDayEntries({
    startDate,
    endDate,
    rangeStart,
    rangeEnd,
    repeatRule,
    seriesEndDate,
    timeZone,
    budget,
  });

  const uniqueDays = new Set<string>();
  for (const dayEntry of dayEntries) {
    uniqueDays.add(dayEntry.occurrenceDay);
  }

  return Array.from(uniqueDays).sort();
};

export const generateOccurrenceDayEntries = ({
  startDate,
  endDate,
  rangeStart,
  rangeEnd,
  repeatRule,
  seriesEndDate,
  timeZone,
  budget,
}: OccurrenceInput): OccurrenceDayEntry[] => {
  consumeStep(budget);
  const occurrenceSet = new Set<string>();
  const dayEntries: OccurrenceDayEntry[] = [];
  const start = toDate(startDate, timeZone);
  const end = toDate(endDate, timeZone);
  const from = toDate(rangeStart, timeZone);
  const to = toDate(rangeEnd, timeZone);
  const seriesEnd = seriesEndDate ? toDate(seriesEndDate, timeZone) : to;

  if (!start.isValid || !end.isValid || !from.isValid || !to.isValid || !seriesEnd.isValid) {
    return dayEntries;
  }

  const spanDays = spanDaysFromDates(start, end);
  const latestOverlappingDay = seriesEnd.plus({ days: spanDays - 1 });

  if (latestOverlappingDay < from || start > to) {
    return dayEntries;
  }

  const clampStart = start > from ? start : from;
  const clampEnd = to;

  const addOccurrenceSpan = (occurrenceStart: DateTime) => {
    const occurrenceStartIso = occurrenceStart.toISODate();
    if (!occurrenceStartIso) {
      return;
    }

    const firstOffset = Math.max(0, Math.round(clampStart.diff(occurrenceStart, "days").days));
    const lastOffset = Math.min(
      spanDays - 1,
      Math.round(clampEnd.diff(occurrenceStart, "days").days),
    );
    for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
      consumeStep(budget);
      const day = occurrenceStart.plus({ days: offset });
      const iso = day.toISODate();
      if (iso) {
        const key = `${occurrenceStartIso}:${iso}`;
        if (occurrenceSet.has(key)) {
          continue;
        }
        consumeEntry(budget);
        occurrenceSet.add(key);
        dayEntries.push({
          occurrenceDay: iso,
          occurrenceStartDate: occurrenceStartIso,
        });
      }
    }
  };

  if (repeatRule === "none") {
    const singleOccurrenceEnds = start.plus({ days: spanDays - 1 });
    if (singleOccurrenceEnds >= clampStart && start <= clampEnd) {
      addOccurrenceSpan(start);
    }
    return dayEntries.sort((a, b) =>
      a.occurrenceDay === b.occurrenceDay
        ? a.occurrenceStartDate.localeCompare(b.occurrenceStartDate)
        : a.occurrenceDay.localeCompare(b.occurrenceDay),
    );
  }

  const earliestRelevantStart = clampStart.minus({ days: spanDays - 1 });
  const latestStart = seriesEnd < clampEnd ? seriesEnd : clampEnd;
  let cursor = start;
  const interval = fixedIntervalDays(repeatRule);
  if (interval) {
    const distanceDays = earliestRelevantStart.diff(start, "days").days;
    const intervalsToSkip = Math.max(0, Math.floor(distanceDays / interval));
    cursor = start.plus({ days: intervalsToSkip * interval });
  } else {
    // Month/year steps depend on preceding clamping, so retain their iterative sequence.
    while (true) {
      consumeStep(budget);
      const nextCursor = advance(cursor, repeatRule);
      if (!nextCursor.isValid || nextCursor.equals(cursor) || nextCursor > earliestRelevantStart)
        break;
      cursor = nextCursor;
    }
  }

  while (cursor <= latestStart) {
    consumeStep(budget);
    const occurrenceEnds = cursor.plus({ days: spanDays - 1 });
    if (occurrenceEnds >= clampStart && cursor <= clampEnd) {
      addOccurrenceSpan(cursor);
    }

    const nextCursor = advance(cursor, repeatRule);
    if (!nextCursor.isValid || nextCursor.equals(cursor)) {
      break;
    }
    cursor = nextCursor;
  }

  return dayEntries.sort((a, b) =>
    a.occurrenceDay === b.occurrenceDay
      ? a.occurrenceStartDate.localeCompare(b.occurrenceStartDate)
      : a.occurrenceDay.localeCompare(b.occurrenceDay),
  );
};

export const isOccurrenceStartInSeries = ({
  occurrenceStartDate,
  startDate,
  endDate,
  repeatRule,
  seriesEndDate,
  budget,
}: Pick<OccurrenceInput, "startDate" | "endDate" | "repeatRule" | "seriesEndDate"> & {
  occurrenceStartDate: string;
  budget?: OccurrenceGenerationBudget;
}) => {
  consumeStep(budget);
  const start = toDate(startDate, "UTC");
  const end = toDate(endDate, "UTC");
  const occurrence = toDate(occurrenceStartDate, "UTC");
  const cutoff = seriesEndDate ? toDate(seriesEndDate, "UTC") : occurrence;
  if (!start.isValid || !end.isValid || !occurrence.isValid || !cutoff.isValid) return false;
  // Start membership does not require expanding the occurrence's span (including legacy long spans).
  if (repeatRule === "none")
    return (
      occurrence.equals(start) &&
      cutoff.plus({ days: spanDaysFromDates(start, end) - 1 }) >= occurrence
    );
  if (occurrence < start || occurrence > cutoff) return false;
  const interval = fixedIntervalDays(repeatRule);
  if (interval) return occurrence.diff(start, "days").days % interval === 0;
  let cursor: DateTime = start;
  while (cursor < occurrence) {
    consumeStep(budget);
    const next = advance(cursor, repeatRule);
    if (!next.isValid || next.equals(cursor)) return false;
    cursor = next;
  }
  return cursor.equals(occurrence);
};
