import { describe, expect, it } from "vitest";
import { translateOccurrenceSeriesDates } from "@/lib/chore-edit-dates";

describe("occurrence-relative series dates", () => {
  it.each([
    ["duration only", "2026-01-19", "2026-01-22", "2026-01-05", "2026-01-08"],
    ["forward shift", "2026-01-21", "2026-01-24", "2026-01-07", "2026-01-10"],
    ["backward shift", "2026-01-16", "2026-01-20", "2026-01-02", "2026-01-06"],
  ])(
    "maps %s without using the selected instance as the series origin",
    (_label, startDate, exclusiveEndDate, start, end) => {
      expect(
        translateOccurrenceSeriesDates({
          seriesStartDate: "2026-01-05",
          occurrenceStartDate: "2026-01-19",
          startDate,
          exclusiveEndDate,
        }),
      ).toEqual({ ok: true, startDate: start, exclusiveEndDate: end });
    },
  );
  it("uses date-only day math across daylight-saving boundaries", () => {
    expect(
      translateOccurrenceSeriesDates({
        seriesStartDate: "2026-03-22",
        occurrenceStartDate: "2026-03-29",
        startDate: "2026-03-30",
        exclusiveEndDate: "2026-04-02",
      }),
    ).toEqual({ ok: true, startDate: "2026-03-23", exclusiveEndDate: "2026-03-26" });
  });
  it.each([
    ["2026-02-30", "2026-03-02", "startDate"],
    ["2026-01-19", "2026-02-30", "endDate"],
    ["2026-01-19", "2026-01-19", "endDate"],
    [null, "2026-01-20", "startDate"],
  ])(
    "rejects invalid relative dates before translating them",
    (startDate, exclusiveEndDate, field) => {
      const result = translateOccurrenceSeriesDates({
        seriesStartDate: "2026-01-05",
        occurrenceStartDate: "2026-01-19",
        startDate,
        exclusiveEndDate,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors).toHaveProperty(field);
    },
  );
});
