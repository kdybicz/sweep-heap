import { describe, expect, it } from "vitest";
import { mapOccurrenceStarts } from "@/lib/occurrences";

const base = {
  sourceStartDate: "2026-01-01",
  sourceRepeatRule: "day" as const,
  sourceSeriesEndDate: null,
  fromDate: "2026-01-01",
  targetStartDate: "2026-01-02",
  targetRepeatRule: "day" as const,
  targetSeriesEndDate: null,
};

describe("series exception ordinal mapping", () => {
  it("shifts adjacent keys without collapsing their identities", () => {
    expect([
      ...mapOccurrenceStarts({ ...base, occurrenceStarts: ["2026-01-01", "2026-01-02"] }),
    ]).toEqual([
      ["2026-01-01", "2026-01-02"],
      ["2026-01-02", "2026-01-03"],
    ]);
  });
  it("counts every instance, not just exceptions, for a following cadence change", () => {
    expect([
      ...mapOccurrenceStarts({
        ...base,
        fromDate: "2026-01-03",
        targetRepeatRule: "week",
        occurrenceStarts: ["2026-01-01", "2026-01-03", "2026-01-05"],
      }),
    ]).toEqual([
      ["2026-01-03", "2026-01-02"],
      ["2026-01-05", "2026-01-16"],
    ]);
  });
  it("drops truncated targets and stale source keys", () => {
    expect([
      ...mapOccurrenceStarts({
        ...base,
        sourceRepeatRule: "week",
        targetRepeatRule: "week",
        targetSeriesEndDate: "2026-01-09",
        occurrenceStarts: ["2026-01-01", "2026-01-02", "2026-01-08", "2026-01-15"],
      }),
    ]).toEqual([
      ["2026-01-01", "2026-01-02"],
      ["2026-01-08", "2026-01-09"],
    ]);
  });
  it("maps only the first instance when converting to a one-off", () => {
    expect([
      ...mapOccurrenceStarts({
        ...base,
        targetRepeatRule: "none",
        occurrenceStarts: ["2026-01-01", "2026-01-02"],
      }),
    ]).toEqual([["2026-01-01", "2026-01-02"]]);
  });
  it("uses iterative month-end stepping on both schedules", () => {
    expect([
      ...mapOccurrenceStarts({
        ...base,
        sourceStartDate: "2026-01-31",
        fromDate: "2026-01-31",
        sourceRepeatRule: "month",
        targetStartDate: "2026-03-31",
        targetRepeatRule: "month",
        occurrenceStarts: ["2026-02-28", "2026-03-28", "2026-03-31"],
      }),
    ]).toEqual([
      ["2026-02-28", "2026-04-30"],
      ["2026-03-28", "2026-05-30"],
    ]);
  });
  it("ignores exceptions beyond the original cutoff", () => {
    expect([
      ...mapOccurrenceStarts({
        ...base,
        sourceSeriesEndDate: "2026-01-01",
        occurrenceStarts: ["2026-01-02"],
      }),
    ]).toEqual([]);
  });
});
