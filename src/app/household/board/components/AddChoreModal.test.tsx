import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AddChoreModal from "@/app/household/board/components/AddChoreModal";

const noop = () => undefined;

describe("AddChoreModal", () => {
  it("renders the refreshed modal sections and actions", () => {
    const markup = renderToStaticMarkup(
      <AddChoreModal
        fieldErrors={{}}
        modalDescription="Add a chore to the current week."
        modalTitle="Add chore"
        newDate="2026-03-11"
        newEndDate="2026-03-11"
        newNotes=""
        newRepeat="none"
        newRepeatEnd=""
        newRepeatEndMode="never"
        newTitle=""
        newType="close_on_done"
        onCancel={noop}
        onClose={noop}
        onDateChange={noop}
        onEndDateChange={noop}
        onNotesChange={noop}
        onRepeatChange={noop}
        onRepeatEndChange={noop}
        onRepeatEndModeChange={noop}
        onSubmit={noop}
        onTitleChange={noop}
        onTypeChange={noop}
        open
        submitDisabled={false}
        submitError={null}
        submitLabel="Create chore"
        submitting={false}
      />,
    );

    expect(markup).toContain("Chore details");
    expect(markup).toContain("Schedule");
    expect(markup).toContain("Notes");
    expect(markup).toContain("Create chore");
    expect(markup).toContain("Close on done");
    expect(markup).toContain("Stays open");
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("max-h-[calc(100dvh-2rem)]");
  });
});
