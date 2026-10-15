import { describe, expect, it } from "vitest";
import {
  applyOptimisticDone,
  restoreTargetChores,
} from "@/app/household/board/chore-actions-state";
import { getWeeklyChoreProgress } from "@/app/household/board/chore-progress";
import type { ChoreItem } from "@/app/household/board/types";
import { generateOccurrenceDayEntries, type RepeatRule } from "@/lib/occurrences";

const rowsFor = ({
  id = 1,
  startDate = "2026-03-09",
  endDate = "2026-03-16",
  repeatRule = "none",
  ...state
}: Partial<ChoreItem> & {
  startDate?: string;
  endDate?: string;
  repeatRule?: RepeatRule;
} = {}): ChoreItem[] =>
  generateOccurrenceDayEntries({
    startDate,
    endDate,
    repeatRule,
    rangeStart: "2026-03-09",
    rangeEnd: "2026-03-15",
    timeZone: "UTC",
  }).map((entry) => ({
    id,
    title: "Fixture",
    type: "close_on_done",
    status: "open",
    closed_reason: null,
    ...state,
    occurrence_date: entry.occurrenceDay,
    occurrence_start_date: entry.occurrenceStartDate,
  }));

describe("weekly chore progress", () => {
  it("reports zero progress for an empty week", () => {
    expect(getWeeklyChoreProgress([])).toEqual({
      totalChores: 0,
      doneChores: 0,
      openChores: 0,
      progress: 0,
    });
  });

  it("counts a completed seven-day occurrence once alongside an open one-day chore", () => {
    const rows = [
      ...rowsFor({ closed_reason: "done", status: "closed" }),
      ...rowsFor({ id: 2, endDate: "2026-03-10" }),
    ];
    expect(rows).toHaveLength(8);
    expect(getWeeklyChoreProgress(rows)).toEqual({
      totalChores: 2,
      doneChores: 1,
      openChores: 1,
      progress: 50,
    });
  });

  it.each([
    ["left", "2026-03-06", "2026-03-11"],
    ["right", "2026-03-13", "2026-03-18"],
    ["both", "2026-03-01", "2026-03-24"],
  ])("counts an occurrence clipped at the %s week boundary once", (_edge, startDate, endDate) => {
    const rows = [
      ...rowsFor({ startDate, endDate, closed_reason: "done" }),
      ...rowsFor({ id: 2, endDate: "2026-03-10" }),
    ];
    expect(getWeeklyChoreProgress(rows)).toEqual({
      totalChores: 2,
      doneChores: 1,
      openChores: 1,
      progress: 50,
    });
  });

  it("keeps overlapping starts of one series and different chores with the same start distinct", () => {
    const repeating = rowsFor({
      startDate: "2026-03-02",
      endDate: "2026-03-11",
      repeatRule: "week",
    }).map((row) => ({
      ...row,
      closed_reason: row.occurrence_start_date === "2026-03-02" ? "done" : null,
    }));
    expect(repeating).toHaveLength(9);
    expect(
      getWeeklyChoreProgress([
        ...repeating,
        ...rowsFor({ id: 2, type: "stay_open", status: "open", closed_reason: "done" }),
      ]),
    ).toEqual({ totalChores: 3, doneChores: 2, openChores: 1, progress: 67 });
  });

  it("uses completion metadata, including stay-open logs, instead of closed status alone", () => {
    expect(
      getWeeklyChoreProgress([
        ...rowsFor({ type: "stay_open", status: "open", closed_reason: "done" }),
        ...rowsFor({ id: 2, status: "closed" }),
        ...rowsFor({ id: 3 }),
      ]),
    ).toEqual({ totalChores: 3, doneChores: 1, openChores: 2, progress: 33 });
  });

  it("updates and restores progress once for an optimistic multi-day completion", () => {
    const original = [...rowsFor(), ...rowsFor({ id: 2, closed_reason: "done" })];
    const completed = applyOptimisticDone({
      chores: original,
      choreId: 1,
      occurrenceStartDate: "2026-03-09",
      optimisticStatus: "closed",
    });
    expect(getWeeklyChoreProgress(completed)).toEqual({
      totalChores: 2,
      doneChores: 2,
      openChores: 0,
      progress: 100,
    });
    const restored = restoreTargetChores({
      chores: completed,
      choreId: 1,
      occurrenceStartDate: "2026-03-09",
      previous: original.filter((row) => row.id === 1),
    });
    expect(getWeeklyChoreProgress(restored)).toEqual({
      totalChores: 2,
      doneChores: 1,
      openChores: 1,
      progress: 50,
    });
  });
});
