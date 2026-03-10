import { describe, expect, it } from "vitest";
import {
  getChoreFormModalCopy,
  getChoreFormModeFromScope,
  getChoreFormValuesFromChore,
  getSeriesEndDateForSubmit,
  isChoreEditDirty,
} from "@/app/household/board/chore-form";
import type { ChoreItem } from "@/app/household/board/types";

const baseChore: ChoreItem = {
  id: 7,
  title: "Laundry",
  type: "close_on_done",
  is_repeating: true,
  series_start_date: "2026-03-01",
  series_end_date: "2026-04-30",
  repeat_rule: "week",
  duration_days: 2,
  occurrence_date: "2026-03-08",
  occurrence_start_date: "2026-03-08",
  status: "open",
  closed_reason: null,
  notes: "Use gentle cycle",
};

describe("chore form helpers", () => {
  it("builds single-occurrence edit defaults", () => {
    expect(getChoreFormValuesFromChore(baseChore, "single")).toEqual({
      title: "Laundry",
      type: "close_on_done",
      date: "2026-03-08",
      endDate: "2026-03-09",
      repeat: "none",
      repeatEndMode: "never",
      repeatEnd: "2026-03-08",
      notes: "Use gentle cycle",
    });
  });

  it("builds all-chores edit defaults from the original series start", () => {
    expect(getChoreFormValuesFromChore(baseChore, "all")).toEqual({
      title: "Laundry",
      type: "close_on_done",
      date: "2026-03-01",
      endDate: "2026-03-02",
      repeat: "weekly",
      repeatEndMode: "on_date",
      repeatEnd: "2026-04-30",
      notes: "Use gentle cycle",
    });
  });

  it("defaults repeat end mode to never when a chore has no series end date", () => {
    expect(
      getChoreFormValuesFromChore(
        {
          ...baseChore,
          repeat_rule: "week",
          series_end_date: null,
        },
        "all",
      ),
    ).toEqual({
      title: "Laundry",
      type: "close_on_done",
      date: "2026-03-01",
      endDate: "2026-03-02",
      repeat: "weekly",
      repeatEndMode: "never",
      repeatEnd: "2026-03-01",
      notes: "Use gentle cycle",
    });
  });

  it("maps canonical repeat rules to UI select values", () => {
    expect(
      getChoreFormValuesFromChore(
        {
          ...baseChore,
          repeat_rule: "biweek",
        },
        "all",
      ).repeat,
    ).toBe("biweekly");
  });

  it("maps scopes to edit form modes", () => {
    expect(getChoreFormModeFromScope("single")).toBe("edit_single");
    expect(getChoreFormModeFromScope("following")).toBe("edit_following");
    expect(getChoreFormModeFromScope("all")).toBe("edit_all");
  });

  it("submits null series end date when repeat end mode is never", () => {
    expect(
      getSeriesEndDateForSubmit({
        repeat: "weekly",
        repeatEndMode: "never",
        repeatEnd: "2026-04-30",
      }),
    ).toBeNull();
  });

  it("submits repeat end date when repeat end mode is on date", () => {
    expect(
      getSeriesEndDateForSubmit({
        repeat: "weekly",
        repeatEndMode: "on_date",
        repeatEnd: "2026-04-30",
      }),
    ).toBe("2026-04-30");
  });

  it("treats unchanged edit form values as not dirty", () => {
    const original = getChoreFormValuesFromChore(baseChore, "all");

    expect(isChoreEditDirty({ original, current: original })).toBe(false);
  });

  it("ignores notes whitespace when checking edit dirtiness", () => {
    const original = getChoreFormValuesFromChore(baseChore, "all");

    expect(
      isChoreEditDirty({
        original,
        current: {
          ...original,
          notes: ` ${original.notes} `,
        },
      }),
    ).toBe(false);
  });

  it("returns all-chores modal copy", () => {
    expect(getChoreFormModalCopy("edit_all")).toEqual({
      title: "Edit all chores",
      description: "Update the entire recurring series in place.",
      submitLabel: "Save changes",
    });
  });
});
