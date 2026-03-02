import { DateTime as LuxonDateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { formatRange, formatWeekdayLabel, startOfWeek } from "@/app/household/board/date-utils";

describe("household date formatting", () => {
  it("formats the week header with full month and year from week start", () => {
    const selectedDay = LuxonDateTime.fromISO("2026-03-05", { zone: "UTC" });
    const weekStart = startOfWeek(selectedDay);

    expect(formatRange(weekStart, weekStart.plus({ days: 6 }))).toBe("March 2026");
  });

  it("keeps the week header month based on first day of week across month boundaries", () => {
    const weekStart = LuxonDateTime.fromISO("2026-01-26", { zone: "UTC" });

    expect(formatRange(weekStart, weekStart.plus({ days: 6 }))).toBe("January 2026");
  });

  it("formats day labels as weekday shortcut and day number", () => {
    const day = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });

    expect(formatWeekdayLabel(day)).toBe("Mon 2");
  });
});
