import { DateTime } from "luxon";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WeekGrid from "@/app/household/board/components/WeekGrid";
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

describe("WeekGrid", () => {
  const days = Array.from({ length: 7 }, (_, index) =>
    DateTime.fromISO("2026-03-02", { zone: "UTC" }).plus({ days: index }),
  );

  it("renders all chores once in the shared board area", () => {
    const markup = renderToStaticMarkup(
      <WeekGrid
        chores={[
          createChore({ id: 1, title: "Single chore" }),
          createChore({
            id: 2,
            title: "Weekend project",
            occurrence_date: "2026-03-03",
            occurrence_start_date: "2026-03-03",
            duration_days: 3,
          }),
          createChore({
            id: 2,
            title: "Weekend project",
            occurrence_date: "2026-03-04",
            occurrence_start_date: "2026-03-03",
            duration_days: 3,
          }),
          createChore({
            id: 2,
            title: "Weekend project",
            occurrence_date: "2026-03-05",
            occurrence_start_date: "2026-03-03",
            duration_days: 3,
          }),
        ]}
        days={days}
        loading={false}
        onAddChoreForDate={noop}
        onNextWeek={noop}
        onPreviousWeek={noop}
        onPreviewChore={noop}
        onResetWeek={noop}
        rangeLabel="Mar 2 - Mar 8"
        today={DateTime.fromISO("2026-03-05", { zone: "UTC" })}
      />,
    );

    expect(markup).toContain("Weekend project");
    expect(markup).toContain("Single chore");
    expect(markup.match(/Weekend project/g)).toHaveLength(1);
    expect(markup.match(/Single chore/g)).toHaveLength(1);
    expect(
      (markup.match(/border-l border-\[var\(--stroke-soft\)\]/g) ?? []).length,
    ).toBeGreaterThanOrEqual(6);
    expect(markup).toContain("No chores scheduled");
  });
});
