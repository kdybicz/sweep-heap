import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ChorePreviewPopover from "@/app/household/board/components/ChorePreviewPopover";
import type { ChoreItem } from "@/app/household/board/types";

const noop = () => undefined;
const anchorRect = { left: 10, top: 20, width: 100, height: 32, bottom: 52 } as DOMRect;

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

describe("ChorePreviewPopover", () => {
  it("renders an open details action and notes placeholder", () => {
    const markup = renderToStaticMarkup(
      <ChorePreviewPopover
        anchorRect={anchorRect}
        chore={createChore({ repeat_rule: "week", notes: null })}
        onClose={noop}
        onOpenDetails={noop}
      />,
    );

    expect(markup).toContain("Open details");
    expect(markup).toContain("Add Notes");
    expect(markup).toContain("Repeats weekly");
  });
});
