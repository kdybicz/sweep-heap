import { DateTime } from "luxon";
import { describe, expect, it, vi } from "vitest";
import {
  generateOccurrenceDayEntries,
  isOccurrenceStartInSeries,
  type OccurrenceInput,
  type RepeatRule,
} from "@/lib/occurrences";
import { generateOccurrencesByStepping } from "../../e2e/legacy-occurrences";

const key = (date: DateTime) => date.toISODate() ?? "";
const rules = ["day", "week", "biweek"] as const;
const windows = {
  UTC: ["2026-03-06", "2026-10-30"],
  "America/New_York": ["2026-03-06", "2026-10-30"],
  "Europe/Warsaw": ["2026-03-27", "2026-10-23"],
  "Asia/Kolkata": ["2026-03-06", "2026-10-30"],
};

describe("fixed-interval range jumps", () => {
  it.each(rules.flatMap((rule) => Object.keys(windows).map((zone) => [rule, zone] as const)))(
    "matches the stepping oracle for %s in %s across DST, overlap and cutoff boundaries",
    (repeatRule, timeZone) => {
      for (const range of windows[timeZone as keyof typeof windows]) {
        const from = DateTime.fromISO(range, { zone: "UTC" });
        const to = from.plus({ days: 6 });
        for (const span of [1, 3, 9, 17]) {
          for (const origin of [
            from.minus({ weeks: 12 }),
            from.minus({ weeks: 12 }).plus({ days: 1 }),
            from.plus({ days: 2 }),
            to.plus({ days: 1 }),
          ]) {
            for (const cutoff of [null, from.minus({ days: 1 }), from.plus({ days: 2 }), to]) {
              const input: OccurrenceInput = {
                startDate: key(origin),
                endDate: key(origin.plus({ days: span })),
                rangeStart: key(from),
                rangeEnd: key(to),
                repeatRule,
                timeZone,
                seriesEndDate: cutoff ? key(cutoff) : null,
              };
              expect(generateOccurrenceDayEntries(input), JSON.stringify(input)).toEqual(
                generateOccurrencesByStepping(input),
              );
            }
          }
        }
      }
    },
  );

  it.each(rules)("keeps %s seek work bounded as the series origin ages", (repeatRule) => {
    const from = DateTime.fromISO("2026-10-12", { zone: "UTC" });
    const inputs = [1, 26, 75].map((years) => {
      // Multiples of 364 preserve phase for all three intervals, keeping visible work equal.
      const origin = from.minus({ days: years * 364 });
      return {
        startDate: key(origin),
        endDate: key(origin.plus({ days: 1 })),
        rangeStart: key(from),
        rangeEnd: key(from.plus({ days: 6 })),
        repeatRule,
        seriesEndDate: null,
        timeZone: "UTC",
      };
    });
    const plus = vi.spyOn(DateTime.prototype, "plus");
    try {
      const counts: number[] = [];
      const outputs = inputs.map((input) => {
        plus.mockClear();
        const rows = generateOccurrenceDayEntries(input);
        counts.push(plus.mock.calls.length);
        return rows;
      });
      expect(outputs[1]).toEqual(outputs[0]);
      expect(outputs[2]).toEqual(outputs[0]);
      expect(counts.every((count) => count < 80)).toBe(true);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);

      for (const input of inputs) {
        plus.mockClear();
        expect(isOccurrenceStartInSeries({ ...input, occurrenceStartDate: key(from) })).toBe(true);
        expect(plus.mock.calls.length).toBeLessThan(25);
      }
    } finally {
      plus.mockRestore();
    }
  });

  it("generates only visible offsets of long overlapping spans", () => {
    const origin = DateTime.fromISO("1950-01-01", { zone: "UTC" });
    const input: OccurrenceInput = {
      startDate: key(origin),
      endDate: key(origin.plus({ days: 250 })),
      rangeStart: "2026-10-12",
      rangeEnd: "2026-10-12",
      repeatRule: "day",
      timeZone: "UTC",
    };
    const plus = vi.spyOn(DateTime.prototype, "plus");
    try {
      const rows = generateOccurrenceDayEntries(input);
      expect(rows).toHaveLength(250);
      expect(rows.every((row) => row.occurrenceDay === "2026-10-12")).toBe(true);
      expect(plus.mock.calls.length).toBeLessThan(10 * rows.length + 20);
      plus.mockClear();
      expect(
        generateOccurrenceDayEntries({
          ...input,
          endDate: "2050-01-01",
          repeatRule: "none",
          rangeEnd: "2026-10-18",
        }),
      ).toHaveLength(7);
      expect(plus.mock.calls.length).toBeLessThan(80);
    } finally {
      plus.mockRestore();
    }
  });

  it.each(rules)(
    "validates %s starts rather than a day inside another occurrence's span",
    (repeatRule) => {
      const step = repeatRule === "day" ? 1 : repeatRule === "week" ? 7 : 14;
      const origin = DateTime.fromISO("2000-01-03", { zone: "UTC" });
      const occurrence = origin.plus({ days: step * 700 });
      const series = {
        startDate: key(origin),
        endDate: key(origin.plus({ days: 3 })),
        repeatRule,
        seriesEndDate: key(occurrence),
      };
      expect(isOccurrenceStartInSeries({ ...series, occurrenceStartDate: key(occurrence) })).toBe(
        true,
      );
      expect(
        isOccurrenceStartInSeries({
          ...series,
          occurrenceStartDate: key(origin.minus({ days: 1 })),
        }),
      ).toBe(false);
      expect(
        isOccurrenceStartInSeries({
          ...series,
          occurrenceStartDate: key(occurrence.plus({ days: step })),
        }),
      ).toBe(false);
      if (step > 1)
        expect(
          isOccurrenceStartInSeries({
            ...series,
            occurrenceStartDate: key(occurrence.minus({ days: step - 1 })),
          }),
        ).toBe(false);
    },
  );

  it.each(["America/Havana", "Pacific/Apia"])(
    "keeps civil dates and fixed recurrence phase in %s after historical midnight changes",
    (timeZone) => {
      for (const repeatRule of rules) {
        const input: OccurrenceInput = {
          startDate: "2000-01-07",
          endDate: "2000-01-10",
          rangeStart: "2026-10-16",
          rangeEnd: "2026-10-18",
          repeatRule,
          seriesEndDate: null,
          timeZone,
        };
        expect(generateOccurrenceDayEntries(input)).toEqual(
          generateOccurrencesByStepping({ ...input, timeZone: "UTC" }),
        );
      }
      expect(
        generateOccurrenceDayEntries({
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          rangeStart: "2026-11-01",
          rangeEnd: "2026-11-01",
          repeatRule: "day",
          timeZone,
        }),
      ).toEqual([{ occurrenceDay: "2026-11-01", occurrenceStartDate: "2026-11-01" }]);
      expect(
        generateOccurrenceDayEntries({
          startDate: "2000-01-01",
          endDate: "2000-01-02",
          rangeStart: "2026-10-16",
          rangeEnd: "2026-10-18",
          repeatRule: "day",
          timeZone,
        }),
      ).toEqual(
        ["2026-10-16", "2026-10-17", "2026-10-18"].map((date) => ({
          occurrenceDay: date,
          occurrenceStartDate: date,
        })),
      );
    },
  );

  it.each(["none"] as RepeatRule[])("retains non-repeating semantics for %s", (repeatRule) => {
    const input: OccurrenceInput = {
      startDate: "2024-01-31",
      endDate: "2024-02-02",
      rangeStart: "2025-02-01",
      rangeEnd: "2026-04-03",
      repeatRule,
      seriesEndDate: null,
      timeZone: "UTC",
    };
    expect(generateOccurrenceDayEntries(input)).toEqual(generateOccurrencesByStepping(input));
    const leap: OccurrenceInput = {
      ...input,
      startDate: "2024-02-29",
      endDate: "2024-03-02",
      rangeStart: "2027-02-27",
      rangeEnd: "2028-03-02",
    };
    expect(generateOccurrenceDayEntries(leap)).toEqual(generateOccurrencesByStepping(leap));
  });

  it("still interprets timestamp input in the household zone before doing civil-date arithmetic", () => {
    expect(
      generateOccurrenceDayEntries({
        startDate: "2026-03-10T02:00:00Z",
        endDate: "2026-03-11T02:00:00Z",
        rangeStart: "2026-03-09",
        rangeEnd: "2026-03-09",
        repeatRule: "none",
        timeZone: "America/New_York",
      }),
    ).toEqual([{ occurrenceDay: "2026-03-09", occurrenceStartDate: "2026-03-09" }]);
  });

  it("rejects invalid dates and zones before jumping", () => {
    const input: OccurrenceInput = {
      startDate: "2000-01-01",
      endDate: "2000-01-02",
      rangeStart: "2026-10-12",
      rangeEnd: "2026-10-18",
      repeatRule: "day",
      timeZone: "UTC",
    };
    expect(generateOccurrenceDayEntries({ ...input, timeZone: "Not/A_Zone" })).toEqual([]);
    expect(generateOccurrenceDayEntries({ ...input, rangeStart: "2026-02-30" })).toEqual([]);
  });
});
