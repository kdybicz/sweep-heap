import { describe, expect, it } from "vitest";

import { normalizeRepeatRule, validateChoreCreate } from "@/lib/chore-validation";

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
      exclusiveEndDate: null,
      repeatRule: "none",
      seriesEndDate: null,
    });

    expect(errors).toEqual({
      title: "Title is required",
      startDate: "Start date is required",
      endDate: "End date is required",
    });
  });

  it("enforces date ordering", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-10",
      exclusiveEndDate: "2026-03-02",
      repeatRule: "week",
      seriesEndDate: null,
    });

    expect(errors.endDate).toBe("End date must be after start date");
  });

  it("requires end date to be after start date", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-10",
      exclusiveEndDate: "2026-03-10",
      repeatRule: "week",
      seriesEndDate: null,
    });

    expect(errors.endDate).toBe("End date must be after start date");
  });

  it("allows past dates", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-02-01",
      exclusiveEndDate: "2026-02-02",
      repeatRule: "week",
      seriesEndDate: null,
    });

    expect(errors.startDate).toBeUndefined();
    expect(errors.endDate).toBeUndefined();
  });

  it("requires repeat end when repeating", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
      type: "close_on_done",
      startDate: "2026-03-02",
      exclusiveEndDate: "2026-03-03",
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
      exclusiveEndDate: "2026-03-11",
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
      exclusiveEndDate: "2026-03-11",
      repeatRule: "none",
      seriesEndDate: null,
    });

    expect(errors.type).toBe("Invalid chore type");
  });
});
