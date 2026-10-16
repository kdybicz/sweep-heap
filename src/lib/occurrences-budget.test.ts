import { describe, expect, it } from "vitest";
import {
  generateOccurrenceDayEntries,
  generateOccurrenceDayKeys,
  isOccurrenceStartInSeries,
  mapOccurrenceStarts,
  type OccurrenceGenerationBudget,
  OccurrenceLimitExceededError,
} from "@/lib/occurrences";

const input = {
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  rangeStart: "2026-01-01",
  rangeEnd: "2026-01-03",
  repeatRule: "day" as const,
  seriesEndDate: null,
  timeZone: "UTC",
};
const budget = (remainingEntries = 2, remainingSteps = 100): OccurrenceGenerationBudget => ({
  remainingEntries,
  remainingSteps,
});
const failure = (run: () => unknown) => {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
};

describe("bounded occurrence work", () => {
  it("throws before allocating more than the entry budget instead of returning a truncated result", () => {
    const cap = budget();
    const error = failure(() => generateOccurrenceDayEntries({ ...input, budget: cap }));
    expect(error).toBeInstanceOf(OccurrenceLimitExceededError);
    expect(error).toMatchObject({ kind: "entries" });
    expect(cap.remainingEntries).toBe(0);
    expect(cap.remainingSteps).toBeGreaterThan(0);
  });
  it("shares the entry budget across series and the day-key wrapper", () => {
    const cap = budget();
    expect(
      generateOccurrenceDayEntries({ ...input, rangeEnd: input.rangeStart, budget: cap }),
    ).toHaveLength(1);
    expect(
      generateOccurrenceDayKeys({ ...input, rangeEnd: input.rangeStart, budget: cap }),
    ).toHaveLength(1);
    expect(
      failure(() =>
        generateOccurrenceDayEntries({ ...input, rangeEnd: input.rangeStart, budget: cap }),
      ),
    ).toMatchObject({ kind: "entries" });
  });
  it("bounds the month/year seek even if no occurrence is emitted", () => {
    for (const repeatRule of ["month", "year"] as const) {
      const cap = budget(100, 2);
      expect(
        failure(() =>
          generateOccurrenceDayEntries({
            ...input,
            repeatRule,
            rangeStart: "2030-10-15",
            rangeEnd: "2030-10-15",
            budget: cap,
          }),
        ),
      ).toMatchObject({ kind: "steps" });
      expect(cap.remainingEntries).toBe(100);
    }
  });
  it("checks fixed starts and legacy one-offs without expanding their spans", () => {
    expect(
      isOccurrenceStartInSeries({
        startDate: "0001-01-01",
        endDate: "0001-01-02",
        repeatRule: "day",
        seriesEndDate: null,
        occurrenceStartDate: "9999-01-01",
        budget: budget(0, 1),
      }),
    ).toBe(true);
    expect(
      isOccurrenceStartInSeries({
        startDate: "1950-01-01",
        endDate: "2050-01-01",
        repeatRule: "none",
        seriesEndDate: null,
        occurrenceStartDate: "1950-01-01",
        budget: budget(0, 1),
      }),
    ).toBe(true);
  });
  it("bounds calendar start validation without generating day entries", () => {
    expect(
      failure(() =>
        isOccurrenceStartInSeries({
          ...input,
          repeatRule: "month",
          occurrenceStartDate: "2030-01-01",
          budget: budget(0, 2),
        }),
      ),
    ).toMatchObject({ kind: "steps" });
  });
  it("bounds exception ordinal mapping as well as list generation", () => {
    const mapping = {
      occurrenceStarts: ["2026-01-01", "2026-01-02"],
      sourceStartDate: "2026-01-01",
      sourceRepeatRule: "day" as const,
      sourceSeriesEndDate: null,
      fromDate: "2026-01-01",
      targetStartDate: "2026-01-02",
      targetRepeatRule: "day" as const,
      targetSeriesEndDate: null,
    };
    expect(failure(() => mapOccurrenceStarts({ ...mapping, budget: budget(1) }))).toMatchObject({
      kind: "entries",
    });
    expect(
      failure(() =>
        mapOccurrenceStarts({
          ...mapping,
          occurrenceStarts: ["2026-01-20"],
          budget: budget(10, 2),
        }),
      ),
    ).toMatchObject({ kind: "steps" });
  });
  it("stops upper-year mappings at the last requested start without advancing beyond it", () => {
    const cap = budget(1, 3);
    expect(
      mapOccurrenceStarts({
        occurrenceStarts: ["9999-01-01"],
        sourceStartDate: "9998-01-01",
        sourceRepeatRule: "year",
        sourceSeriesEndDate: null,
        fromDate: "9998-01-01",
        targetStartDate: "9998-01-01",
        targetRepeatRule: "year",
        targetSeriesEndDate: null,
        budget: cap,
      }),
    ).toEqual(new Map([["9999-01-01", "9999-01-01"]]));
    // A legacy off-schedule exception must not make the cursor compare expanded years as strings.
    expect(
      mapOccurrenceStarts({
        occurrenceStarts: ["9999-12-31"],
        sourceStartDate: "9998-01-01",
        sourceRepeatRule: "year",
        sourceSeriesEndDate: null,
        fromDate: "9998-01-01",
        targetStartDate: "9998-01-01",
        targetRepeatRule: "year",
        targetSeriesEndDate: null,
        budget: budget(1, 5),
      }),
    ).toEqual(new Map());
  });
  it.each(["none", "day", "week", "biweek", "month", "year"] as const)(
    "keeps direct %s membership equivalent to generated start identities",
    (repeatRule) => {
      const series = { startDate: "2024-01-31", endDate: "2024-02-03", repeatRule };
      for (const seriesEndDate of [null, "2024-01-30", "2025-03-15"]) {
        for (const occurrenceStartDate of [
          "2024-01-30",
          "2024-01-31",
          "2024-02-01",
          "2024-02-29",
          "2024-03-29",
          "2024-03-31",
          "2025-02-28",
          "2025-03-16",
        ]) {
          const expected = generateOccurrenceDayEntries({
            ...series,
            seriesEndDate,
            rangeStart: occurrenceStartDate,
            rangeEnd: occurrenceStartDate,
            timeZone: "UTC",
          }).some((row) => row.occurrenceStartDate === occurrenceStartDate);
          expect(isOccurrenceStartInSeries({ ...series, seriesEndDate, occurrenceStartDate })).toBe(
            expected,
          );
        }
      }
    },
  );
});
