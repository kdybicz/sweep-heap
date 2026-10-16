import { DateTime } from "luxon";
import type { OccurrenceDayEntry, OccurrenceInput, RepeatRule } from "../src/lib/occurrences";

// Pre-#30 generator retained as an independent comparison/benchmark oracle, not app code.
const toDate = (value: string, timeZone: string) =>
  DateTime.fromISO(value, { zone: timeZone }).startOf("day");
const advance = (value: DateTime, rule: RepeatRule): DateTime => {
  if (rule === "day") return value.plus({ days: 1 });
  if (rule === "week") return value.plus({ weeks: 1 });
  if (rule === "biweek") return value.plus({ weeks: 2 });
  if (rule === "month") return value.plus({ months: 1 });
  if (rule === "year") return value.plus({ years: 1 });
  return value;
};

export const generateOccurrencesByStepping = ({
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
  if (!start.isValid || !end.isValid || !from.isValid || !to.isValid || !seriesEnd.isValid)
    return dayEntries;
  const spanDays = Math.max(Math.round(end.diff(start, "days").days), 1);
  if (seriesEnd.plus({ days: spanDays - 1 }) < from || start > to) return dayEntries;
  const clampStart = start > from ? start : from;
  const clampEnd = to;
  const addSpan = (occurrenceStart: DateTime) => {
    const occurrenceStartDate = occurrenceStart.toISODate();
    if (!occurrenceStartDate) return;
    for (let offset = 0; offset < spanDays; offset += 1) {
      const day = occurrenceStart.plus({ days: offset });
      if (day < clampStart || day > clampEnd) continue;
      const occurrenceDay = day.toISODate();
      if (!occurrenceDay) continue;
      const key = `${occurrenceStartDate}:${occurrenceDay}`;
      if (occurrenceSet.has(key)) continue;
      occurrenceSet.add(key);
      dayEntries.push({ occurrenceDay, occurrenceStartDate });
    }
  };
  const sorted = () =>
    dayEntries.sort((a, b) =>
      a.occurrenceDay === b.occurrenceDay
        ? a.occurrenceStartDate.localeCompare(b.occurrenceStartDate)
        : a.occurrenceDay.localeCompare(b.occurrenceDay),
    );
  if (repeatRule === "none") {
    if (start.plus({ days: spanDays - 1 }) >= clampStart && start <= clampEnd) addSpan(start);
    return sorted();
  }
  const earliestRelevantStart = clampStart.minus({ days: spanDays - 1 });
  const latestStart = seriesEnd < clampEnd ? seriesEnd : clampEnd;
  let cursor: DateTime = start;
  while (true) {
    const next = advance(cursor, repeatRule);
    if (next.equals(cursor) || next > earliestRelevantStart) break;
    cursor = next;
  }
  while (cursor <= latestStart) {
    if (cursor.plus({ days: spanDays - 1 }) >= clampStart && cursor <= clampEnd) addSpan(cursor);
    const next = advance(cursor, repeatRule);
    if (next.equals(cursor)) break;
    cursor = next;
  }
  return sorted();
};
