import { DateTime } from "luxon";

import { describe, expect, it } from "vitest";

import { normalizeRepeatRule, validateChoreCreate } from "@/lib/chore-validation";
import { toISODateOrThrow } from "@/lib/date";

describe("normalizeRepeatRule", () => {
  it("maps human-friendly values", () => {
    expect(normalizeRepeatRule("daily")).toBe("day");
    expect(normalizeRepeatRule("weekly")).toBe("week");
    expect(normalizeRepeatRule("biweekly")).toBe("biweek");
    expect(normalizeRepeatRule("monthly")).toBe("month");
    expect(normalizeRepeatRule("yearly")).toBe("year");
  });

  it("preserves already normalized values", () => {
    expect(normalizeRepeatRule("week")).toBe("week");
    expect(normalizeRepeatRule("biweek")).toBe("biweek");
  });
});

describe("validateChoreCreate", () => {
  it("requires core fields", () => {
    const errors = validateChoreCreate({
      title: "",
      type: "close_on_done",
      startDate: null,
      endDate: null,
      repeatRule: "none",
      seriesEndDate: null,
    });

    expect(errors).toEqual({
      title: "Title is required",
      startDate: "Start date is required",
      endDate: "End date is required",
      today: "Missing household-local today value",
    });
  });

  it("enforces date ordering", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-10",
      endDate: "2026-03-02",
      repeatRule: "week",
      seriesEndDate: null,
    });

    expect(errors.endDate).toBe("End date must be on or after start date");
  });

  it("prevents past dates", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-02-01",
      endDate: "2026-02-02",
      repeatRule: "week",
      seriesEndDate: null,
      today: "2026-02-10",
    });

    expect(errors.startDate).toBe("Start date cannot be in the past");
    expect(errors.endDate).toBe("End date cannot be in the past");
  });

  it("accepts household-local today when UTC is ahead", () => {
    const laToday = DateTime.fromISO("2026-02-10T23:30:00", {
      zone: "America/Los_Angeles",
    });
    const utcToday = toISODateOrThrow(laToday.toUTC());
    const householdToday = toISODateOrThrow(laToday);

    expect(utcToday).toBe("2026-02-11");
    expect(householdToday).toBe("2026-02-10");

    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: householdToday,
      endDate: householdToday,
      repeatRule: "none",
      seriesEndDate: null,
      today: householdToday,
    });

    expect(errors.startDate).toBeUndefined();
    expect(errors.endDate).toBeUndefined();
  });

  it("requires a household-local today value", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-01",
      endDate: "2026-03-01",
      repeatRule: "none",
      seriesEndDate: null,
    });

    expect(errors.today).toBe("Missing household-local today value");
  });

  it("requires repeat end when repeating", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      repeatRule: "none",
      seriesEndDate: "2026-04-01",
    });

    expect(errors.repeatEnd).toBe("Repeat end is only allowed when repeating");
  });

  it("validates repeat end against start date", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-10",
      endDate: "2026-03-10",
      repeatRule: "week",
      seriesEndDate: "2026-03-02",
    });

    expect(errors.repeatEnd).toBe("Repeat end must be on or after start date");
  });

  it("requires a valid chore type", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "something_else",
      startDate: "2026-03-10",
      endDate: "2026-03-10",
      repeatRule: "none",
      seriesEndDate: null,
      today: "2026-03-01",
    });

    expect(errors.type).toBe("Invalid chore type");
  });
});
