import type { DateTime } from "luxon";
import { DateTime as LuxonDateTime } from "luxon";

export const toDateKey = (date: DateTime) => date.toISODate();

export const getHouseholdToday = (timeZone: string) =>
  LuxonDateTime.now().setZone(timeZone).startOf("day");

export const getHouseholdTodayKey = (timeZone: string) =>
  toDateKey(getHouseholdToday(timeZone)) ?? LuxonDateTime.utc().toISODate() ?? "";

export const getNextHouseholdMidnightDelay = (
  timeZone: string,
  now: DateTime = LuxonDateTime.now(),
) => {
  const midnight = now.setZone(timeZone).plus({ days: 1 }).startOf("day");
  // Some zones repeat midnight. Today changes at its first occurrence, not its second.
  const firstMidnight = Math.min(...midnight.getPossibleOffsets().map((date) => date.toMillis()));
  return Math.max(1, firstMidnight - now.toMillis());
};

export const addDaysToDateKey = (dateKey: string, days: number) => {
  const parsed = LuxonDateTime.fromISO(dateKey, { zone: "UTC" }).startOf("day");
  if (!parsed.isValid) {
    return dateKey;
  }
  return parsed.plus({ days }).toISODate() ?? dateKey;
};

export const subtractDaysFromDateKey = (dateKey: string, days: number) =>
  addDaysToDateKey(dateKey, -days);

export const startOfWeek = (date: DateTime) =>
  date.minus({ days: date.weekday - 1 }).startOf("day");

export const formatRange = (start: DateTime) => start.toFormat("LLLL yyyy");

export const formatWeekdayLabel = (date: DateTime) => date.toFormat("ccc d");
