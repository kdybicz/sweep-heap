import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { buildWeekGridLayout } from "@/app/household/board/multi-day-chore-layout";
import type { ChoreItem } from "@/app/household/board/types";

const createDayChore = (overrides: Partial<ChoreItem> = {}): ChoreItem => ({
  id: 1,
  title: "Chore",
  type: "close_on_done",
  occurrence_date: "2026-03-02",
  occurrence_start_date: "2026-03-02",
  duration_days: 1,
  status: "open",
  closed_reason: null,
  ...overrides,
});

describe("buildWeekGridLayout", () => {
  const days = Array.from({ length: 7 }, (_, index) =>
    DateTime.fromISO("2026-03-02", { zone: "UTC" }).plus({ days: index }),
  );

  it("places single-day and multi-day chores into the same shared lanes", () => {
    const layout = buildWeekGridLayout({
      days,
      todayKey: "2026-03-05",
      chores: [
        createDayChore({ id: 1, title: "Single" }),
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-03",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-04",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-05",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
      ],
    });

    expect(layout.choreLanes).toHaveLength(1);
    expect(layout.choreLanes[0]).toEqual([
      expect.objectContaining({ startCol: 0, colSpan: 1 }),
      expect.objectContaining({ startCol: 1, colSpan: 3 }),
    ]);
    expect(layout.occupiedDayKeys).toEqual(
      new Set(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]),
    );
  });

  it("adds overlapping multi-day chores to separate lanes", () => {
    const layout = buildWeekGridLayout({
      days,
      todayKey: "2026-03-05",
      chores: [
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-03",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-04",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
        createDayChore({
          id: 2,
          title: "Trip",
          occurrence_date: "2026-03-05",
          occurrence_start_date: "2026-03-03",
          duration_days: 3,
        }),
        createDayChore({
          id: 3,
          title: "Renovation",
          occurrence_date: "2026-03-04",
          occurrence_start_date: "2026-03-04",
          duration_days: 2,
        }),
        createDayChore({
          id: 3,
          title: "Renovation",
          occurrence_date: "2026-03-05",
          occurrence_start_date: "2026-03-04",
          duration_days: 2,
        }),
      ],
    });

    expect(layout.choreLanes).toHaveLength(2);
  });

  it("marks chores that continue outside the current week", () => {
    const layout = buildWeekGridLayout({
      days,
      todayKey: "2026-03-05",
      chores: [
        createDayChore({
          id: 4,
          title: "Carryover",
          occurrence_date: "2026-03-02",
          occurrence_start_date: "2026-02-28",
          duration_days: 6,
        }),
        createDayChore({
          id: 4,
          title: "Carryover",
          occurrence_date: "2026-03-03",
          occurrence_start_date: "2026-02-28",
          duration_days: 6,
        }),
        createDayChore({
          id: 4,
          title: "Carryover",
          occurrence_date: "2026-03-04",
          occurrence_start_date: "2026-02-28",
          duration_days: 6,
        }),
      ],
    });

    expect(layout.choreLanes[0]?.[0]).toEqual(
      expect.objectContaining({ continuesBefore: true, continuesAfter: true }),
    );
  });

  it("does not mark a right-edge continuation when a carryover chore ends within the week", () => {
    const layout = buildWeekGridLayout({
      days,
      todayKey: "2026-03-05",
      chores: [
        createDayChore({
          id: 5,
          title: "Carry-in only",
          occurrence_date: "2026-03-02",
          occurrence_start_date: "2026-03-01",
          duration_days: 3,
        }),
        createDayChore({
          id: 5,
          title: "Carry-in only",
          occurrence_date: "2026-03-03",
          occurrence_start_date: "2026-03-01",
          duration_days: 3,
        }),
      ],
    });

    expect(layout.choreLanes[0]?.[0]).toEqual(
      expect.objectContaining({ continuesBefore: true, continuesAfter: false, colSpan: 2 }),
    );
  });
});
