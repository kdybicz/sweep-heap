import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MultiDayChoreLanes from "@/app/household/board/components/MultiDayChoreLanes";
import type { MultiDaySpan } from "@/app/household/board/multi-day-chore-layout";
import type { ChoreItem } from "@/app/household/board/types";

const noop = () => undefined;

const createChore = (overrides: Partial<ChoreItem> = {}): ChoreItem => ({
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

describe("MultiDayChoreLanes", () => {
  it("shows continuation indicators for chores clipped by the visible week", () => {
    const lanes: MultiDaySpan[][] = [
      [
        {
          key: "1:2026-03-02",
          chore: createChore({ title: "Spanning chore", duration_days: 5 }),
          startCol: 0,
          colSpan: 3,
          continuesBefore: true,
          continuesAfter: true,
        },
      ],
    ];

    const markup = renderToStaticMarkup(<MultiDayChoreLanes lanes={lanes} onSelectChore={noop} />);

    expect(markup).toContain('data-continuation="left"');
    expect(markup).toContain('data-continuation="right"');
    expect(markup).toContain('class="relative px-2"');
    expect(markup).toContain("rounded-l-none border-l-0");
    expect(markup).toContain("rounded-r-none border-r-0");
  });
});
