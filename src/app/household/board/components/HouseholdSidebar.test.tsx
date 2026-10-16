import { DateTime } from "luxon";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HouseholdSidebar from "@/app/household/board/components/HouseholdSidebar";
import type { ChoreItem } from "@/app/household/board/types";

const createChore = (overrides: Partial<ChoreItem> = {}): ChoreItem => ({
  id: 1,
  title: "Chore",
  type: "close_on_done",
  occurrence_date: "2026-03-10",
  occurrence_start_date: "2026-03-10",
  duration_days: 1,
  status: "open",
  closed_reason: null,
  ...overrides,
});

describe("HouseholdSidebar", () => {
  it("collapses multi-day today chores to a single card", () => {
    const markup = renderToStaticMarkup(
      <HouseholdSidebar
        doneChores={0}
        weekLoadState={{ loading: false, fetching: false, hasData: true, hasError: false }}
        todayLoadState={{ loading: false, fetching: false, hasData: true, hasError: false }}
        onRetryToday={() => undefined}
        openChores={3}
        progress={0}
        today={DateTime.fromISO("2026-03-10", { zone: "UTC" })}
        todayChores={[
          createChore({ id: 1, title: "Trip", occurrence_date: "2026-03-10", duration_days: 2 }),
          createChore({
            id: 1,
            title: "Trip",
            occurrence_date: "2026-03-11",
            occurrence_start_date: "2026-03-10",
            duration_days: 2,
          }),
          createChore({ id: 2, title: "Single" }),
        ]}
        totalChores={3}
      />,
    );

    expect(markup.match(/Trip/g)).toHaveLength(1);
    expect(markup).toContain("Single");
  });
  it.each([false, true])(
    "distinguishes failed loads from empty data, with cached data=%s",
    (hasData) => {
      const state = { loading: false, fetching: false, hasData, hasError: true };
      const markup = renderToStaticMarkup(
        <HouseholdSidebar
          doneChores={1}
          totalChores={2}
          openChores={1}
          progress={50}
          today={DateTime.fromISO("2026-03-10", { zone: "UTC" })}
          todayChores={hasData ? [createChore({ title: "Cached chore" })] : []}
          weekLoadState={state}
          todayLoadState={state}
          onRetryToday={() => undefined}
        />,
      );
      expect(markup).toContain("Retry today");
      expect(markup).not.toContain("No chores scheduled");
      expect(markup.includes("1/2 done")).toBe(hasData);
      expect(markup.includes("Cached chore")).toBe(hasData);
      expect(markup.includes("Last-known progress")).toBe(hasData);
      expect(markup.includes("Week progress unavailable")).toBe(!hasData);
    },
  );
});
