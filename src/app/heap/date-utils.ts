import type { DateTime } from "luxon";
import { DateTime as LuxonDateTime } from "luxon";

export const toDateKey = (date: DateTime) => date.toISODate();

export const getHouseholdToday = (timeZone: string) =>
  LuxonDateTime.now().setZone(timeZone).startOf("day");

export const getHouseholdTodayKey = (timeZone: string) =>
  toDateKey(getHouseholdToday(timeZone)) ?? LuxonDateTime.utc().toISODate() ?? "";

export const startOfWeek = (date: DateTime) =>
  date.minus({ days: date.weekday - 1 }).startOf("day");

export const formatRange = (start: DateTime, end: DateTime) => {
  const sameMonth = start.hasSame(end, "month");
  const sameYear = start.hasSame(end, "year");
  const startLabel = `${start.toFormat("LLL d")}`;
  const endLabel = `${end.toFormat("LLL d")}`;

  if (sameMonth) {
    return `${start.toFormat("LLL d")}–${end.toFormat("d")}, ${start.toFormat("yyyy")}`;
  }

  if (sameYear) {
    return `${startLabel}–${endLabel}, ${start.toFormat("yyyy")}`;
  }

  return `${startLabel}, ${start.toFormat("yyyy")}–${endLabel}, ${end.toFormat("yyyy")}`;
};
