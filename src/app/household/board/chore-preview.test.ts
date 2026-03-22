import { describe, expect, it } from "vitest";

import {
  areChorePreviewDatesDirty,
  createChorePreviewSaveTrackingState,
  enqueueChorePreviewSave,
  findPreviewChoreForTarget,
  finishChorePreviewSave,
  getChorePreviewDateChangeScopeOptions,
  getChorePreviewDateLabel,
  getChorePreviewDateMutationTarget,
  getChorePreviewDayOffset,
  getChorePreviewFormState,
  getChorePreviewMutationTarget,
  getChorePreviewRepeatChangeScopeOptions,
  getChorePreviewRepeatEndLabel,
  getChorePreviewRepeatLabel,
  getChorePreviewSelectionKey,
  getDefaultPreviewRepeatEndDate,
  getOpenDetailsPreviewChore,
  getPreviewPopoverChore,
  isFirstChoreOccurrenceInSeries,
  resetChorePreviewSaveTrackingState,
} from "@/app/household/board/chore-preview";
import type { ChoreItem } from "@/app/household/board/types";

const createChore = (overrides: Partial<ChoreItem> = {}): ChoreItem => ({
  id: 1,
  title: "Chore",
  type: "close_on_done",
  occurrence_date: "2026-03-11",
  occurrence_start_date: "2026-03-11",
  duration_days: 1,
  status: "open",
  closed_reason: null,
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
};

const flushMicrotasks = async (count = 3) => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

describe("chore preview helpers", () => {
  it("formats a multi-day date range", () => {
    expect(
      getChorePreviewDateLabel(
        createChore({ occurrence_start_date: "2026-03-11", duration_days: 2 }),
      ),
    ).toBe("11 Mar 2026 - 12 Mar 2026");
  });

  it("formats repeat cadence without showing the series end", () => {
    expect(getChorePreviewRepeatLabel(createChore({ repeat_rule: "biweek" }))).toBe(
      "Repeats every 2 weeks",
    );
    expect(getChorePreviewRepeatLabel(createChore({ repeat_rule: "none" }))).toBeNull();
  });

  it("builds editable preview state from chore dates and repeat settings", () => {
    expect(
      getChorePreviewFormState(
        createChore({
          occurrence_start_date: "2026-03-11",
          duration_days: 2,
          repeat_rule: "week",
          series_end_date: "2026-04-30",
        }),
      ),
    ).toEqual({
      startDate: "2026-03-11",
      endDate: "2026-03-12",
      repeat: "weekly",
      repeatEndMode: "on_date",
      repeatEnd: "2026-04-30",
    });
  });

  it("detects when preview dates have changed", () => {
    expect(
      areChorePreviewDatesDirty(createChore(), {
        startDate: "2026-03-12",
        endDate: "2026-03-12",
      }),
    ).toBe(true);

    expect(
      areChorePreviewDatesDirty(createChore(), {
        startDate: "2026-03-11",
        endDate: "2026-03-11",
      }),
    ).toBe(false);
  });

  it("identifies the first occurrence in a series", () => {
    expect(
      isFirstChoreOccurrenceInSeries(
        createChore({
          is_repeating: true,
          series_start_date: "2026-03-11",
        }),
      ),
    ).toBe(true);

    expect(
      isFirstChoreOccurrenceInSeries(
        createChore({
          is_repeating: true,
          series_start_date: "2026-03-01",
        }),
      ),
    ).toBe(false);
  });

  it("builds recurring scope options for first and later occurrences", () => {
    expect(
      getChorePreviewDateChangeScopeOptions(
        createChore({
          is_repeating: true,
          series_start_date: "2026-03-11",
        }),
      ),
    ).toEqual([
      { scope: "single", label: "Only current chore" },
      { scope: "all", label: "All chores" },
    ]);

    expect(
      getChorePreviewDateChangeScopeOptions(
        createChore({
          is_repeating: true,
          series_start_date: "2026-03-01",
        }),
      ),
    ).toEqual([
      { scope: "single", label: "Only current chore" },
      { scope: "following", label: "All future chores" },
    ]);

    expect(
      getChorePreviewRepeatChangeScopeOptions(
        createChore({
          is_repeating: true,
          series_start_date: "2026-03-01",
        }),
      ),
    ).toEqual([
      { scope: "single", label: "Only current chore" },
      { scope: "following", label: "All future chores" },
    ]);
  });

  it("formats repeat end labels for recurring chores", () => {
    expect(
      getChorePreviewRepeatEndLabel(
        createChore({
          repeat_rule: "week",
          series_end_date: "2026-04-30",
        }),
      ),
    ).toBe("30 Apr 2026");

    expect(getChorePreviewRepeatEndLabel(createChore({ repeat_rule: "week" }))).toBe("Never");
  });

  it("defaults an inline repeat end date to the chore start", () => {
    expect(getDefaultPreviewRepeatEndDate("2026-03-11")).toBe("2026-03-11");
  });

  it("builds preview offsets and selection keys from the current occurrence", () => {
    const chore = createChore({
      is_repeating: true,
      occurrence_date: "2026-03-13",
      occurrence_start_date: "2026-03-11",
    });

    expect(getChorePreviewDayOffset(chore)).toBe(2);
    expect(getChorePreviewSelectionKey(chore)).toBe("1:2026-03-11:2");
  });

  it("rebinding falls back to the nearest remaining day when the old offset disappears", () => {
    const target = {
      choreId: 1,
      occurrenceStartDate: "2026-03-20",
    };

    expect(
      findPreviewChoreForTarget({
        chores: [
          createChore({
            is_repeating: false,
            occurrence_date: "2026-03-20",
            occurrence_start_date: "2026-03-20",
          }),
        ],
        target,
        preferredOffset: 2,
      }),
    ).toEqual(
      createChore({
        is_repeating: false,
        occurrence_date: "2026-03-20",
        occurrence_start_date: "2026-03-20",
      }),
    );
  });

  it("rebinding keeps the exact target day when it still exists", () => {
    expect(
      findPreviewChoreForTarget({
        chores: [
          createChore({
            is_repeating: true,
            occurrence_date: "2026-03-20",
            occurrence_start_date: "2026-03-20",
          }),
          createChore({
            is_repeating: true,
            occurrence_date: "2026-03-21",
            occurrence_start_date: "2026-03-20",
          }),
        ],
        target: {
          choreId: 1,
          occurrenceStartDate: "2026-03-20",
        },
        preferredOffset: 1,
      }),
    ).toEqual(
      createChore({
        is_repeating: true,
        occurrence_date: "2026-03-21",
        occurrence_start_date: "2026-03-20",
      }),
    );
  });

  it("builds a follow-up mutation target from returned chore ids", () => {
    expect(
      getChorePreviewMutationTarget({
        chore: createChore({ id: 3, occurrence_start_date: "2026-03-11" }),
        targetChoreId: 8,
        targetOccurrenceStartDate: "2026-03-20",
      }),
    ).toEqual({
      choreId: 8,
      occurrenceStartDate: "2026-03-20",
    });

    expect(
      getChorePreviewMutationTarget({
        chore: createChore({ id: 3, occurrence_start_date: "2026-03-11" }),
      }),
    ).toBeNull();
  });

  it("keeps preview targets aligned to the moved start date for in-place one-off edits", () => {
    expect(
      getChorePreviewDateMutationTarget({
        chore: createChore({ id: 3, is_repeating: false, occurrence_start_date: "2026-03-11" }),
        scope: "all",
        startDate: "2026-03-20",
        targetChoreId: 3,
      }),
    ).toEqual({
      choreId: 3,
      occurrenceStartDate: "2026-03-20",
    });
  });

  it("uses the new start date when a date edit creates a follow-up chore", () => {
    expect(
      getChorePreviewDateMutationTarget({
        chore: createChore({ id: 3, is_repeating: true, occurrence_start_date: "2026-03-11" }),
        scope: "single",
        startDate: "2026-03-20",
        targetChoreId: 8,
        targetOccurrenceStartDate: "2026-03-11",
      }),
    ).toEqual({
      choreId: 8,
      occurrenceStartDate: "2026-03-20",
    });
  });

  it("does not fall back to stale preview data when a requested details target is missing", () => {
    const activePreviewChore = createChore({
      id: 1,
      is_repeating: true,
      occurrence_date: "2026-03-13",
      occurrence_start_date: "2026-03-11",
    });

    expect(
      getOpenDetailsPreviewChore({
        chores: [],
        activePreviewChore,
        target: {
          choreId: 9,
          occurrenceStartDate: "2026-03-20",
        },
      }),
    ).toBeNull();

    expect(
      getOpenDetailsPreviewChore({
        chores: [],
        activePreviewChore,
      }),
    ).toEqual(activePreviewChore);
  });

  it("keeps rendering the previous preview chore while a target transition is pending", () => {
    const previewChore = createChore({
      id: 7,
      is_repeating: true,
      occurrence_date: "2026-03-13",
      occurrence_start_date: "2026-03-11",
    });

    expect(
      getPreviewPopoverChore({
        previewChore,
        visiblePreviewChore: null,
        pendingPreviewTarget: {
          choreId: 9,
          occurrenceStartDate: "2026-03-20",
        },
        pendingDetailsTarget: null,
      }),
    ).toEqual(previewChore);

    expect(
      getPreviewPopoverChore({
        previewChore,
        visiblePreviewChore: null,
        pendingPreviewTarget: null,
        pendingDetailsTarget: null,
      }),
    ).toBeNull();
  });

  it("serializes saves within the same preview session", async () => {
    const calls: string[] = [];
    const firstSaveDeferred = createDeferred<void>();
    const secondSaveDeferred = createDeferred<void>();
    let saveState = createChorePreviewSaveTrackingState();

    const firstSave = enqueueChorePreviewSave({
      state: saveState,
      task: async () => {
        calls.push("first");
        await firstSaveDeferred.promise;
      },
    });
    saveState = firstSave.state;

    const secondSave = enqueueChorePreviewSave({
      state: saveState,
      task: async () => {
        calls.push("second");
        await secondSaveDeferred.promise;
      },
    });
    saveState = secondSave.state;

    await flushMicrotasks();
    expect(calls).toEqual(["first"]);

    firstSaveDeferred.resolve();
    await firstSave.promise;
    saveState = finishChorePreviewSave({
      state: saveState,
      sessionId: firstSave.sessionId,
    }).state;

    await flushMicrotasks();
    expect(calls).toEqual(["first", "second"]);

    secondSaveDeferred.resolve();
    await secondSave.promise;
    const finishedSecondSave = finishChorePreviewSave({
      state: saveState,
      sessionId: secondSave.sessionId,
    });

    expect(finishedSecondSave.state.pendingCount).toBe(0);
    expect(finishedSecondSave.isSaving).toBe(false);
  });

  it("starts a new session immediately after resetting save tracking", async () => {
    const calls: string[] = [];
    const firstSaveDeferred = createDeferred<void>();
    const secondSaveDeferred = createDeferred<void>();
    let saveState = createChorePreviewSaveTrackingState();

    const firstSave = enqueueChorePreviewSave({
      state: saveState,
      task: async () => {
        calls.push("first");
        await firstSaveDeferred.promise;
      },
    });
    saveState = firstSave.state;

    await flushMicrotasks();
    expect(calls).toEqual(["first"]);

    saveState = resetChorePreviewSaveTrackingState(saveState);

    const secondSave = enqueueChorePreviewSave({
      state: saveState,
      task: async () => {
        calls.push("second");
        await secondSaveDeferred.promise;
      },
    });
    saveState = secondSave.state;

    await flushMicrotasks();
    expect(calls).toEqual(["first", "second"]);

    firstSaveDeferred.resolve();
    await firstSave.promise;
    const finishedFirstSave = finishChorePreviewSave({
      state: saveState,
      sessionId: firstSave.sessionId,
    });

    expect(finishedFirstSave.state.sessionId).toBe(secondSave.sessionId);
    expect(finishedFirstSave.state.pendingCount).toBe(1);
    expect(finishedFirstSave.isSaving).toBe(true);

    secondSaveDeferred.resolve();
    await secondSave.promise;
    const finishedSecondSave = finishChorePreviewSave({
      state: finishedFirstSave.state,
      sessionId: secondSave.sessionId,
    });

    expect(finishedSecondSave.state.pendingCount).toBe(0);
    expect(finishedSecondSave.isSaving).toBe(false);
  });
});
