import { describe, expect, it } from "vitest";

import { generateOccurrences } from "@/lib/occurrences";

const timeZone = "Europe/Warsaw";

describe("generateOccurrences", () => {
  it("returns weekly single-day occurrences", () => {
    const occurrences = generateOccurrences({
      startDate: "2026-02-23",
      endDate: "2026-02-23",
      rangeStart: "2026-03-02",
      rangeEnd: "2026-03-08",
      repeatRule: "week",
      seriesEndDate: "2026-03-23",
      timeZone,
    });

    expect(occurrences).toEqual(["2026-03-02"]);
  });

  it("returns two-day weekly occurrences", () => {
    const occurrences = generateOccurrences({
      startDate: "2026-02-27",
      endDate: "2026-02-28",
      rangeStart: "2026-03-02",
      rangeEnd: "2026-03-08",
      repeatRule: "week",
      seriesEndDate: "2026-03-28",
      timeZone,
    });

    expect(occurrences).toEqual(["2026-03-06", "2026-03-07"]);
  });

  it("includes span days that start before the range", () => {
    const occurrences = generateOccurrences({
      startDate: "2026-03-01",
      endDate: "2026-03-02",
      rangeStart: "2026-03-02",
      rangeEnd: "2026-03-08",
      repeatRule: "week",
      seriesEndDate: "2026-03-29",
      timeZone,
    });

    expect(occurrences).toEqual(["2026-03-02", "2026-03-08"]);
  });

  it("repeats monthly with a multi-day span", () => {
    const occurrences = generateOccurrences({
      startDate: "2025-01-01",
      endDate: "2025-01-08",
      rangeStart: "2025-02-01",
      rangeEnd: "2025-02-10",
      repeatRule: "month",
      seriesEndDate: null,
      timeZone,
    });

    expect(occurrences).toEqual([
      "2025-02-01",
      "2025-02-02",
      "2025-02-03",
      "2025-02-04",
      "2025-02-05",
      "2025-02-06",
      "2025-02-07",
      "2025-02-08",
    ]);
  });

  it("spans across multiple weeks and covers all days in range", () => {
    const occurrences = generateOccurrences({
      startDate: "2026-03-01",
      endDate: "2026-03-10",
      rangeStart: "2026-03-02",
      rangeEnd: "2026-03-15",
      repeatRule: "week",
      seriesEndDate: "2026-03-29",
      timeZone,
    });

    expect(occurrences).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
    ]);
  });

  it("covers a later range for a multi-week span", () => {
    const occurrences = generateOccurrences({
      startDate: "2026-03-01",
      endDate: "2026-03-10",
      rangeStart: "2026-03-16",
      rangeEnd: "2026-03-22",
      repeatRule: "week",
      seriesEndDate: "2026-03-29",
      timeZone,
    });

    expect(occurrences).toEqual([
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
      "2026-03-20",
      "2026-03-21",
      "2026-03-22",
    ]);
  });
});
