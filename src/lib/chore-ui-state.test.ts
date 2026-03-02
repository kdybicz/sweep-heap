import { describe, expect, it } from "vitest";

import {
  getChoreStateLabel,
  getPrimaryActionLabel,
  isPrimaryActionDisabled,
} from "@/lib/chore-ui-state";

describe("chore UI state", () => {
  it("shows 'Log completion' for stay-open chores before first log", () => {
    const label = getPrimaryActionLabel({
      type: "stay_open",
      status: "open",
      closed_reason: null,
    });

    expect(label).toBe("Log completion");
  });

  it("shows 'Log again' for stay-open chores after a log", () => {
    const label = getPrimaryActionLabel({
      type: "stay_open",
      status: "open",
      closed_reason: "done",
    });

    expect(label).toBe("Log again");
  });

  it("does not disable action for stay-open chores that were already logged today", () => {
    const disabled = isPrimaryActionDisabled({
      chore: {
        type: "stay_open",
        status: "open",
        closed_reason: "done",
        occurrence_date: "2026-03-02",
      },
      todayKey: "2026-03-02",
    });

    expect(disabled).toBe(false);
  });

  it("keeps close-on-done chores disabled once completed", () => {
    const disabled = isPrimaryActionDisabled({
      chore: {
        type: "close_on_done",
        status: "closed",
        closed_reason: "done",
        occurrence_date: "2026-03-02",
      },
      todayKey: "2026-03-02",
    });

    expect(disabled).toBe(true);
  });

  it("renders 'Logged' state label for stay-open completion", () => {
    const label = getChoreStateLabel({
      type: "stay_open",
      status: "open",
      closed_reason: "done",
    });

    expect(label).toBe("Logged");
  });
});
