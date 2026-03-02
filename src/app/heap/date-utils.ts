import type { DateTime } from "luxon";
import { DateTime as LuxonDateTime } from "luxon";

export const toDateKey = (date: DateTime) => date.toISODate();

export const getHouseholdToday = (timeZone: string) =>
  LuxonDateTime.now().setZone(timeZone).startOf("day");

export const getHouseholdTodayKey = (timeZone: string) =>
  toDateKey(getHouseholdToday(timeZone)) ?? LuxonDateTime.utc().toISODate() ?? "";

export const startOfWeek = (date: DateTime) =>
  date.minus({ days: date.weekday - 1 }).startOf("day");

export const formatRange = (start: DateTime, _end?: DateTime) => start.toFormat("LLLL yyyy");

export const formatWeekdayLabel = (date: DateTime) => date.toFormat("ccc d");
