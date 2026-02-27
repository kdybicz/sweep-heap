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

const toDate = (value: string, timeZone: string) =>
  DateTime.fromISO(value, { zone: timeZone }).startOf("day");

const spanDaysFromDates = (start: DateTime, end: DateTime) =>
  Math.max(Math.round(end.diff(start, "days").days) + 1, 1);

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

export const generateOccurrences = ({
  startDate,
  endDate,
  rangeStart,
  rangeEnd,
  repeatRule,
  seriesEndDate,
  timeZone,
}: OccurrenceInput) => {
  const occurrenceSet = new Set<string>();
  const start = toDate(startDate, timeZone);
  const end = toDate(endDate, timeZone);
  const from = toDate(rangeStart, timeZone);
  const to = toDate(rangeEnd, timeZone);
  const seriesEnd = seriesEndDate ? toDate(seriesEndDate, timeZone) : to;

  if (!start.isValid || !end.isValid || !from.isValid || !to.isValid || !seriesEnd.isValid) {
    return [];
  }

  if (seriesEnd < from || start > to) {
    return [];
  }

  const clampStart = start > from ? start : from;
  const clampEnd = seriesEnd < to ? seriesEnd : to;
  const spanDays = spanDaysFromDates(start, end);

  const addOccurrenceSpan = (occurrenceStart: DateTime) => {
    for (let offset = 0; offset < spanDays; offset += 1) {
      const day = occurrenceStart.plus({ days: offset });
      if (day < clampStart || day > clampEnd) {
        continue;
      }
      const iso = day.toISODate();
      if (iso) {
        occurrenceSet.add(iso);
      }
    }
  };

  if (repeatRule === "none") {
    if (start >= clampStart && start <= clampEnd) {
      addOccurrenceSpan(start);
    }
    return Array.from(occurrenceSet).sort();
  }

  let cursor = start;
  while (true) {
    const nextCursor = advance(cursor, repeatRule);
    if (nextCursor > clampStart) {
      break;
    }
    cursor = nextCursor;
  }

  while (cursor <= clampEnd) {
    addOccurrenceSpan(cursor);
    const nextCursor = advance(cursor, repeatRule);
    if (nextCursor.equals(cursor)) {
      break;
    }
    cursor = nextCursor;
  }

  return Array.from(occurrenceSet).sort();
};
