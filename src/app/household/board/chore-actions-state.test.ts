import { describe, expect, it } from "vitest";

import {
  applyOptimisticDone,
  findTargetChores,
  restoreTargetChores,
} from "@/app/household/board/chore-actions-state";
import type { ChoreItem } from "@/app/household/board/types";

const createChore = ({
  id,
  occurrenceDate,
  occurrenceStartDate = occurrenceDate,
  status = "open",
  closedReason = null,
}: {
  id: number;
  occurrenceDate: string;
  occurrenceStartDate?: string;
  status?: string;
  closedReason?: string | null;
}): ChoreItem => ({
  id,
  title: `Chore ${id}`,
  type: "close_on_done",
  occurrence_date: occurrenceDate,
  occurrence_start_date: occurrenceStartDate,
  status,
  closed_reason: closedReason,
  notes: null,
});

describe("chore-actions-state", () => {
  it("captures every row for a multi-day occurrence", () => {
    const chores = [
      createChore({ id: 1, occurrenceDate: "2026-03-07", occurrenceStartDate: "2026-03-07" }),
      createChore({ id: 1, occurrenceDate: "2026-03-08", occurrenceStartDate: "2026-03-07" }),
      createChore({ id: 2, occurrenceDate: "2026-03-07", occurrenceStartDate: "2026-03-07" }),
    ];

    expect(
      findTargetChores({ chores, choreId: 1, occurrenceStartDate: "2026-03-07" }).map(
        (chore) => chore.occurrence_date,
      ),
    ).toEqual(["2026-03-07", "2026-03-08"]);
  });

  it("restores each multi-day row to its own snapshot after optimistic done", () => {
    const chores = [
      createChore({ id: 1, occurrenceDate: "2026-03-07", occurrenceStartDate: "2026-03-07" }),
      createChore({ id: 1, occurrenceDate: "2026-03-08", occurrenceStartDate: "2026-03-07" }),
    ];
    const previous = findTargetChores({
      chores,
      choreId: 1,
      occurrenceStartDate: "2026-03-07",
    });

    const optimistic = applyOptimisticDone({
      chores,
      choreId: 1,
      occurrenceStartDate: "2026-03-07",
      optimisticStatus: "closed",
    });

    const restored = restoreTargetChores({
      chores: optimistic,
      choreId: 1,
      occurrenceStartDate: "2026-03-07",
      previous,
    });

    expect(restored).toEqual(chores);
  });
});
