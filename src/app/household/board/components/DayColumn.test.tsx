import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DayColumn from "@/app/household/board/components/DayColumn";

const noop = () => undefined;

const buildProps = ({ dayKey = "2026-03-02", showEmptyState = false } = {}) => ({
  dayKey,
  showEmptyState,
  loading: false,
  onAddChoreForDate: noop,
});

describe("DayColumn", () => {
  it("keeps add chore enabled for days before today", () => {
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ dayKey: "2026-03-01" })} />);

    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Add chore<\/button>/);
  });

  it("keeps add chore enabled for today", () => {
    const markup = renderToStaticMarkup(<DayColumn {...buildProps()} />);

    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Add chore<\/button>/);
  });

  it("renders no-chore copy when a day has no chores", () => {
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ showEmptyState: true })} />);

    expect(markup).toContain("No chores scheduled");
  });

  it("omits no-chore copy when a day has chores", () => {
    const markup = renderToStaticMarkup(<DayColumn {...buildProps()} />);

    expect(markup).not.toContain("No chores scheduled");
  });
});
