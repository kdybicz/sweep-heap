import { describe, expect, it } from "vitest";

import {
  getStoredChoreDurationDays,
  toExclusiveChoreEndDate,
  toInclusiveChoreEndDate,
} from "@/lib/chore-date-range";

describe("chore date range helpers", () => {
  it("builds an inclusive end date from a stored duration", () => {
    expect(
      toInclusiveChoreEndDate({
        startDate: "2026-03-08",
        durationDays: 2,
      }),
    ).toBe("2026-03-09");
  });

  it("converts an inclusive end date to the next-day exclusive boundary", () => {
    expect(toExclusiveChoreEndDate("2026-03-09")).toBe("2026-03-10");
  });

  it("derives stored duration days from an exclusive end boundary", () => {
    expect(
      getStoredChoreDurationDays({
        startDate: "2026-03-08",
        exclusiveEndDate: "2026-03-10",
      }),
    ).toBe(2);
  });
});
