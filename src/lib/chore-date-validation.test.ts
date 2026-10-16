import { describe, expect, it } from "vitest";
import {
  getChoreDateSpanErrors,
  getChorePatchDateErrors,
  getChoreQueryInputErrors,
  getChoreQueryRangeErrors,
  isValidChoreDateInput,
  isValidChoreDateKey,
  normalizeChoreDate,
} from "@/lib/chore-date-validation";

describe("chore calendar date validation", () => {
  it.each(["0001-01-01", "9999-12-31", "2000-02-29", "2024-02-29", "2026-12-31"])(
    "accepts a real supported date %s",
    (date) => {
      expect(isValidChoreDateKey(date)).toBe(true);
      expect(normalizeChoreDate(date, "America/Havana")).toBe(date);
    },
  );
  it.each([
    "0000-01-01",
    "+010000-01-01",
    "10000-01-01",
    "1900-02-29",
    "2026-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-00-10",
    "2026-13-01",
    "2026-01-00",
    "2026-01-32",
    "2026-1-1",
    "2026-01",
    "2026-W01-1",
    "2026-001",
    " 2026-01-01",
    "2026-01-01 ",
    "",
    "nonsense",
  ])("rejects malformed or unsupported input %j", (date) => {
    expect(isValidChoreDateInput(date)).toBe(false);
    expect(normalizeChoreDate(date, "UTC")).toBeNull();
  });
  it.each([null, undefined, 20260101, false, {}, [], new Date("bad")])(
    "rejects non-date values %j",
    (date) => {
      expect(isValidChoreDateInput(date)).toBe(false);
      expect(normalizeChoreDate(date, "UTC")).toBeNull();
    },
  );
  it("keeps literal civil dates across a local midnight/day skip", () => {
    expect(normalizeChoreDate("2011-12-30", "Pacific/Apia")).toBe("2011-12-30");
    expect(normalizeChoreDate("2026-03-08", "America/Havana")).toBe("2026-03-08");
  });
  it.each([
    ["2026-03-10T02:00:00Z", "America/New_York", "2026-03-09"],
    ["2026-01-01T23:30:00Z", "Asia/Tokyo", "2026-01-02"],
    ["2026-03-08T23:30:00", "America/New_York", "2026-03-08"],
  ])("normalizes %s in %s to its household date", (value, zone, expected) => {
    expect(isValidChoreDateInput(value)).toBe(true);
    expect(normalizeChoreDate(value, zone)).toBe(expected);
  });
  it("rejects invalid timestamp calendar/clock components and resolved year overflow", () => {
    for (const value of [
      "2026-02-30T12:00:00Z",
      "2026-01-01T99:00:00Z",
      "2026-01-01T12:00:00+99:00",
      "2026-01-01T12:00:00+01:99",
      "2026-01-01T12:00:00+99:00[UTC]",
      "2026-01-01T12:00:00+01:99[UTC]",
      `2026-01-01T00:00:00.${"1".repeat(80)}Z`,
    ])
      expect(isValidChoreDateInput(value)).toBe(false);
    expect(normalizeChoreDate("9999-12-31T23:00:00Z", "Pacific/Kiritimati")).toBeNull();
    expect(normalizeChoreDate("0001-01-01T00:00:00+14:00", "UTC")).toBeNull();
  });
  it("retains Date-object support for internal callers", () => {
    expect(normalizeChoreDate(new Date("2026-01-01T23:30:00Z"), "Asia/Tokyo")).toBe("2026-01-02");
  });
  it("retains valid ISO end-of-day and numeric-offset forms", () => {
    expect(normalizeChoreDate("2026-01-01T24:00:00Z", "UTC")).toBe("2026-01-02");
    expect(normalizeChoreDate("2026-01-01T23:00:00+0530", "Asia/Kolkata")).toBe("2026-01-01");
  });
});

describe("date span and list bounds", () => {
  it("allows a leap-year duration of 366 days and rejects 367", () => {
    expect(getChoreDateSpanErrors("2024-01-01", "2025-01-01")).toEqual({});
    expect(getChoreDateSpanErrors("2024-01-01", "2025-01-02")).toHaveProperty("endDate");
    expect(getChoreDateSpanErrors("2026-01-01", "2026-01-01")).toEqual({
      endDate: "End date must be after start date",
    });
    expect(getChoreDateSpanErrors("2026-01-02", "2026-01-01")).toHaveProperty("endDate");
  });
  it("counts query endpoints inclusively, with 31 days supported", () => {
    expect(getChoreQueryRangeErrors("2026-01-01", "2026-01-31")).toEqual({});
    expect(getChoreQueryRangeErrors("2026-01-01", "2026-02-01")).toHaveProperty("end");
    expect(getChoreQueryRangeErrors("2026-01-01", "2026-01-01")).toEqual({});
    expect(getChoreQueryRangeErrors("2026-01-02", "2026-01-01")).toHaveProperty("end");
  });
  it("requires explicit query endpoints together and does not silently default malformed values", () => {
    expect(getChoreQueryInputErrors(null, null)).toEqual({});
    expect(getChoreQueryInputErrors("2026-01-01", null)).toHaveProperty("end");
    expect(getChoreQueryInputErrors(null, "2026-01-01")).toHaveProperty("start");
    expect(getChoreQueryInputErrors("", "")).toHaveProperty("start");
    expect(getChoreQueryInputErrors("2026-02-30", "2026-03-01")).toHaveProperty("start");
    expect(getChoreQueryInputErrors("0001-01-01", "9999-12-31")).toHaveProperty("end");
  });
  it("defers timestamp range width to household normalization", () => {
    expect(getChoreQueryInputErrors("2026-01-01T23:00:00Z", "2026-02-01T00:00:00Z")).toEqual({});
    expect(
      getChoreQueryRangeErrors(
        normalizeChoreDate("2026-01-01T23:00:00Z", "America/New_York"),
        normalizeChoreDate("2026-02-01T00:00:00Z", "America/New_York"),
      ),
    ).toEqual({});
  });
});

describe("supplied patch dates", () => {
  it.each(["single", "following", "all"])(
    "rejects invalid supplied %s edit dates instead of defaults",
    (scope) => {
      expect(
        getChorePatchDateErrors({
          action: "edit",
          scope,
          startDate: "2026-02-30",
          endDate: "",
          seriesEndDate: "bad",
          occurrenceStartDate: "2026-13-01",
        }),
      ).toEqual({
        startDate: "Invalid start date",
        endDate: "Invalid end date",
        repeatEnd: "Invalid repeat end date",
        occurrenceStartDate: "Invalid occurrence start date",
      });
    },
  );
  it("distinguishes omitted edit fields from null/empty dates and allows explicit repeat-end clearing", () => {
    expect(getChorePatchDateErrors({ action: "edit", seriesEndDate: null })).toEqual({});
    expect(
      getChorePatchDateErrors({ action: "edit", startDate: null, endDate: null }),
    ).toHaveProperty("startDate");
    expect(getChorePatchDateErrors({ action: "edit", seriesEndDate: "" })).toHaveProperty(
      "repeatEnd",
    );
  });
  it("keeps missing create fields for required-field validation", () => {
    expect(getChorePatchDateErrors({ action: "create", startDate: null, endDate: "" })).toEqual({});
  });
  it.each(["set", "cancel", "edit"])("validates target dates for %s before lookup", (action) => {
    expect(getChorePatchDateErrors({ action, occurrenceStartDate: "2026-02-30" })).toEqual({
      occurrenceStartDate: "Invalid occurrence start date",
    });
  });
});
