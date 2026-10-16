import { DateTime } from "luxon";

export type RepeatRule = "none" | "day" | "week" | "biweek" | "month" | "year";

export type OccurrenceInput = {
  startDate: string;
  endDate: string;
  rangeStart: string;
  rangeEnd: string;
  repeatRule: RepeatRule;
  seriesEndDate?: string | null;
  timeZone: string;
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
}: {
  occurrenceStarts: string[];
  sourceStartDate: string;
  sourceRepeatRule: RepeatRule;
  sourceSeriesEndDate: string | null;
  fromDate: string;
  targetStartDate: string;
  targetRepeatRule: RepeatRule;
  targetSeriesEndDate: string | null;
}) => {
  const mapping = new Map<string, string>();
  const wanted = new Set(occurrenceStarts);
  const last = [...wanted].sort().at(-1);
  if (!last) return mapping;
  let source: DateTime = toDate(sourceStartDate, "UTC");
  let target: DateTime = toDate(targetStartDate, "UTC");
  let targetAvailable = true;
  while (source.isValid) {
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
      if (wanted.has(sourceDate)) mapping.set(sourceDate, targetDate);
      if (targetRepeatRule === "none") targetAvailable = false;
      else target = advance(target, targetRepeatRule);
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
}: OccurrenceInput) => {
  const dayEntries = generateOccurrenceDayEntries({
    startDate,
    endDate,
    rangeStart,
    rangeEnd,
    repeatRule,
    seriesEndDate,
    timeZone,
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
}: OccurrenceInput): OccurrenceDayEntry[] => {
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
      const day = occurrenceStart.plus({ days: offset });
      const iso = day.toISODate();
      if (iso) {
        const key = `${occurrenceStartIso}:${iso}`;
        if (occurrenceSet.has(key)) {
          continue;
        }
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
      const nextCursor = advance(cursor, repeatRule);
      if (nextCursor.equals(cursor) || nextCursor > earliestRelevantStart) break;
      cursor = nextCursor;
    }
  }

  while (cursor <= latestStart) {
    const occurrenceEnds = cursor.plus({ days: spanDays - 1 });
    if (occurrenceEnds >= clampStart && cursor <= clampEnd) {
      addOccurrenceSpan(cursor);
    }

    const nextCursor = advance(cursor, repeatRule);
    if (nextCursor.equals(cursor)) {
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
  ...series
}: Pick<OccurrenceInput, "startDate" | "endDate" | "repeatRule" | "seriesEndDate"> & {
  occurrenceStartDate: string;
}) =>
  generateOccurrenceDayEntries({
    ...series,
    rangeStart: occurrenceStartDate,
    rangeEnd: occurrenceStartDate,
    timeZone: "UTC",
  }).some((entry) => entry.occurrenceStartDate === occurrenceStartDate);
