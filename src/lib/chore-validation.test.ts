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
      startDate: null,
      endDate: null,
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
      startDate: "2026-03-10",
      endDate: "2026-03-02",
      repeatRule: "week",
      seriesEndDate: null,
    });

    expect(errors.endDate).toBe("End date must be on or after start date");
  });

  it("requires repeat end when repeating", () => {
    const errors = validateChoreCreate({
      title: "Sweep",
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
      startDate: "2026-03-10",
      endDate: "2026-03-10",
      repeatRule: "week",
      seriesEndDate: "2026-03-02",
    });

    expect(errors.repeatEnd).toBe("Repeat end must be on or after start date");
  });
});
