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

const toDate = (value: string, timeZone: string) =>
  DateTime.fromISO(value, { zone: timeZone }).startOf("day");

const spanDaysFromDates = (start: DateTime, end: DateTime) =>
  Math.max(Math.round(end.diff(start, "days").days), 1);

const advance = (value: DateTime, repeatRule: RepeatRule) => {
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

    for (let offset = 0; offset < spanDays; offset += 1) {
      const day = occurrenceStart.plus({ days: offset });
      if (day < clampStart || day > clampEnd) {
        continue;
      }
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

  while (true) {
    const nextCursor = advance(cursor, repeatRule);
    if (nextCursor.equals(cursor)) {
      break;
    }
    if (nextCursor > earliestRelevantStart) {
      break;
    }
    cursor = nextCursor;
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
