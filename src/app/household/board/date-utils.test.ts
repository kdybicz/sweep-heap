import { DateTime as LuxonDateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  formatRange,
  formatWeekdayLabel,
  getNextHouseholdMidnightDelay,
  startOfWeek,
} from "@/app/household/board/date-utils";

describe("household date formatting", () => {
  it("formats the week header with full month and year from week start", () => {
    const selectedDay = LuxonDateTime.fromISO("2026-03-05", { zone: "UTC" });
    const weekStart = startOfWeek(selectedDay);

    expect(formatRange(weekStart)).toBe("March 2026");
  });

  it("keeps the week header month based on first day of week across month boundaries", () => {
    const weekStart = LuxonDateTime.fromISO("2026-01-26", { zone: "UTC" });

    expect(formatRange(weekStart)).toBe("January 2026");
  });

  it("formats day labels as weekday shortcut and day number", () => {
    const day = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });

    expect(formatWeekdayLabel(day)).toBe("Mon 2");
  });

  it("adds days to date keys", () => {
    expect(addDaysToDateKey("2026-03-02", 1)).toBe("2026-03-03");
  });

  it.each([
    ["2026-03-08T00:00:00-05:00", "America/New_York", 23 * 60 * 60 * 1000],
    ["2026-11-01T00:00:00-04:00", "America/New_York", 25 * 60 * 60 * 1000],
    ["2026-03-08T18:29:00Z", "Asia/Kolkata", 60 * 1000],
  ])("schedules the next local midnight from %s in %s", (instant, timeZone, expected) => {
    expect(getNextHouseholdMidnightDelay(timeZone, LuxonDateTime.fromISO(instant))).toBe(expected);
  });
});
