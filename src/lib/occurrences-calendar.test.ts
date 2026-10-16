import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  generateOccurrenceDayEntries,
  generateOccurrenceDayKeys,
  isOccurrenceStartInSeries,
  mapOccurrenceStarts,
} from "@/lib/occurrences";

const starts = (
  startDate: string,
  repeatRule: "month" | "year",
  rangeStart: string,
  rangeEnd: string,
  extra = {},
) => [
  ...new Set(
    generateOccurrenceDayEntries({
      startDate,
      endDate: DateTime.fromISO(startDate, { zone: "UTC" }).plus({ days: 1 }).toISODate() ?? "",
      repeatRule,
      rangeStart,
      rangeEnd,
      timeZone: "UTC",
      ...extra,
    }).map((row) => row.occurrenceStartDate),
  ),
];

describe("original calendar-day anchors", () => {
  it.each([
    ["2026-01-31", ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]],
    ["2026-01-30", ["2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30", "2026-05-30"]],
    ["2024-01-31", ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30", "2024-05-31"]],
    ["2024-01-29", ["2024-01-29", "2024-02-29", "2024-03-29", "2024-04-29", "2024-05-29"]],
  ] as const)("clamps each month independently from %s", (origin, expected) => {
    expect(starts(origin, "month", origin, `${origin.slice(0, 4)}-05-31`)).toEqual(expected);
  });
  it("uses a day-of-month anchor, not an end-of-month flag", () => {
    expect(starts("2026-04-30", "month", "2026-04-01", "2026-07-31")).toEqual([
      "2026-04-30",
      "2026-05-30",
      "2026-06-30",
      "2026-07-30",
    ]);
  });
  it.each([2024, 2096, 2396])("restores leap day after clamped years from %i", (year) => {
    const expected = Array.from({ length: 9 }, (_, index) => {
      const target = year + index;
      const leap = target % 4 === 0 && (target % 100 !== 0 || target % 400 === 0);
      return `${target}-02-${leap ? "29" : "28"}`;
    });
    expect(starts(`${year}-02-29`, "year", `${year}-01-01`, `${year + 8}-12-31`)).toEqual(expected);
  });
  it.each(["UTC", "America/New_York", "America/Havana", "Pacific/Apia"])(
    "keeps clipped spans and cutoffs in civil dates in %s",
    (timeZone) => {
      const input = {
        startDate: "2026-01-31",
        endDate: "2026-02-03",
        repeatRule: "month" as const,
        rangeStart: "2026-04-01",
        rangeEnd: "2026-04-02",
        timeZone,
      };
      expect(generateOccurrenceDayEntries(input)).toEqual(
        ["2026-04-01", "2026-04-02"].map((occurrenceDay) => ({
          occurrenceDay,
          occurrenceStartDate: "2026-03-31",
        })),
      );
      expect(generateOccurrenceDayEntries({ ...input, seriesEndDate: "2026-03-30" })).toEqual([]);
      expect(generateOccurrenceDayKeys({ ...input, seriesEndDate: "2026-03-31" })).toEqual([
        "2026-04-01",
        "2026-04-02",
      ]);
    },
  );
  it("preserves an inherited anchor at a clamped split and rejects drifted starts", () => {
    const series = {
      startDate: "2026-02-28",
      endDate: "2026-03-01",
      repeatRule: "month" as const,
      anchorDay: 31,
      seriesEndDate: null,
    };
    expect(starts(series.startDate, "month", "2026-02-01", "2026-05-31", series)).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
    expect(isOccurrenceStartInSeries({ ...series, occurrenceStartDate: "2026-03-31" })).toBe(true);
    expect(isOccurrenceStartInSeries({ ...series, occurrenceStartDate: "2026-03-28" })).toBe(false);
    expect(starts("2025-02-28", "year", "2025-01-01", "2028-12-31", { anchorDay: 29 })).toEqual([
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });
  it("maps inherited source/target anchors by ordinal through cadence changes", () => {
    expect(
      mapOccurrenceStarts({
        occurrenceStarts: ["2026-02-28", "2026-03-31", "2026-04-30"],
        sourceStartDate: "2026-02-28",
        sourceRepeatRule: "month",
        sourceAnchorDay: 31,
        sourceSeriesEndDate: null,
        fromDate: "2026-02-28",
        targetStartDate: "2027-02-28",
        targetRepeatRule: "year",
        targetAnchorDay: 29,
        targetSeriesEndDate: null,
      }),
    ).toEqual(
      new Map([
        ["2026-02-28", "2027-02-28"],
        ["2026-03-31", "2028-02-29"],
        ["2026-04-30", "2029-02-28"],
      ]),
    );
  });
  it("matches independently computed original-origin periods across the Gregorian cycle", () => {
    for (const repeatRule of ["month", "year"] as const) {
      const origin = DateTime.fromISO("2000-02-29", { zone: "UTC" });
      const count = repeatRule === "month" ? 4801 : 401;
      const expected = Array.from({ length: count }, (_, ordinal) =>
        origin.plus(repeatRule === "month" ? { months: ordinal } : { years: ordinal }).toISODate(),
      );
      expect(starts("2000-02-29", repeatRule, "2000-02-29", "2400-02-29")).toEqual(expected);
    }
  });
});
