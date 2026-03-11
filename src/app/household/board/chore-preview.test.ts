import { describe, expect, it } from "vitest";

import {
  getChorePreviewDateLabel,
  getChorePreviewRepeatLabel,
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
});
