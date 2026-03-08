import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ChoreDetailsModal from "@/app/household/board/components/ChoreDetailsModal";
import type { ChoreItem } from "@/app/household/board/types";

const noop = () => undefined;

const baseChore: ChoreItem = {
  id: 7,
  title: "Laundry",
  type: "close_on_done",
  is_repeating: false,
  occurrence_date: "2026-03-05",
  occurrence_start_date: "2026-03-05",
  status: "open",
  closed_reason: null,
  notes: "Use gentle cycle",
};

const renderModal = (chore: ChoreItem) =>
  renderToStaticMarkup(
    <ChoreDetailsModal
      chore={chore}
      error={null}
      onCancelAction={noop}
      onClose={noop}
      onPrimaryAction={noop}
      submitting={false}
      todayKey="2026-03-05"
    />,
  );

describe("ChoreDetailsModal", () => {
  it("shows single cancel action for one-off chores", () => {
    const markup = renderModal(baseChore);

    expect(markup).toContain("Cancel this occurrence");
    expect(markup).not.toContain("Cancel this and following");
  });

  it("shows following cancel action for repeating chores", () => {
    const markup = renderModal({
      ...baseChore,
      is_repeating: true,
    });

    expect(markup).toContain("Cancel this occurrence");
    expect(markup).toContain("Cancel this and following");
  });

  it("disables cancel actions for past occurrences", () => {
    const markup = renderToStaticMarkup(
      <ChoreDetailsModal
        chore={{
          ...baseChore,
          is_repeating: true,
          occurrence_date: "2026-03-04",
          occurrence_start_date: "2026-03-04",
        }}
        error={null}
        onCancelAction={noop}
        onClose={noop}
        onPrimaryAction={noop}
        submitting={false}
        todayKey="2026-03-05"
      />,
    );

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Cancel this occurrence<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Cancel this and following<\/button>/);
  });

  it("renders inline API errors", () => {
    const markup = renderToStaticMarkup(
      <ChoreDetailsModal
        chore={{ ...baseChore, is_repeating: true }}
        error="Failed to cancel chore occurrence"
        onCancelAction={noop}
        onClose={noop}
        onPrimaryAction={noop}
        submitting={false}
        todayKey="2026-03-05"
      />,
    );

    expect(markup).toContain("Failed to cancel chore occurrence");
  });

  it("disables the backdrop close affordance while submitting", () => {
    const markup = renderToStaticMarkup(
      <ChoreDetailsModal
        chore={{ ...baseChore, is_repeating: true }}
        error={null}
        onCancelAction={noop}
        onClose={noop}
        onPrimaryAction={noop}
        submitting
        todayKey="2026-03-05"
      />,
    );

    expect(markup).toMatch(/aria-label="Close chore details dialog"[^>]*disabled=""/);
  });
});
