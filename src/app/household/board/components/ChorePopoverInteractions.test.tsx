// @vitest-environment jsdom

import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import BoardChoreButton from "@/app/household/board/components/BoardChoreButton";
import ChorePreviewPopover from "@/app/household/board/components/ChorePreviewPopover";
import type { ChoreItem } from "@/app/household/board/types";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => undefined;

const createChore = (overrides: Partial<ChoreItem> = {}): ChoreItem => ({
  id: 1,
  title: "Laundry",
  type: "close_on_done",
  is_repeating: false,
  occurrence_date: "2026-03-11",
  occurrence_start_date: "2026-03-11",
  duration_days: 1,
  status: "open",
  closed_reason: null,
  notes: null,
  ...overrides,
});

const mountedRoots: Root[] = [];
const mountedContainers: HTMLDivElement[] = [];

const render = async (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mountedContainers.push(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(element);
  });

  return { container };
};

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    if (!root) {
      continue;
    }

    await act(async () => {
      root.unmount();
    });
  }

  while (mountedContainers.length > 0) {
    mountedContainers.pop()?.remove();
  }

  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("chore popover interactions", () => {
  it("opens the preview popover from keyboard-triggered button clicks", async () => {
    const chore = createChore();
    const onPreviewChore = vi.fn();
    const { container } = await render(
      <BoardChoreButton chore={chore} onPreviewChore={onPreviewChore} />,
    );

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));

    expect(onPreviewChore).toHaveBeenCalledTimes(1);
    expect(onPreviewChore).toHaveBeenCalledWith(chore, button);
  });

  it("restores focus to the trigger when Escape closes the preview popover", async () => {
    const chore = createChore();
    const anchorElement = document.createElement("button");
    anchorElement.dataset.chorePreviewId = String(chore.id);
    anchorElement.dataset.chorePreviewStart = chore.occurrence_start_date;
    anchorElement.textContent = chore.title;
    document.body.appendChild(anchorElement);

    const otherButton = document.createElement("button");
    otherButton.textContent = "other";
    document.body.appendChild(otherButton);

    const onClose = vi.fn();

    await render(
      <ChorePreviewPopover
        anchorElement={anchorElement}
        canManageChores
        chore={chore}
        onClose={onClose}
        onPrimaryAction={noop}
        onRebindPreviewTarget={noop}
        onDeleteChore={async () => null}
        onSaveDateChanges={async () => ({ error: null })}
        onSaveTitleTypeChanges={async () => ({ error: null })}
        onSaveNotesChanges={async () => ({ error: null })}
        onSaveRepeatChanges={async () => ({ error: null })}
        selectionKey="1:single:0"
        todayKey="2026-03-11"
      />,
    );

    otherButton.focus();
    expect(document.activeElement).toBe(otherButton);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(anchorElement);
  });

  it("moves focus into the preview when it opens", async () => {
    const chore = createChore();
    const anchorElement = document.createElement("button");
    anchorElement.dataset.chorePreviewId = String(chore.id);
    anchorElement.dataset.chorePreviewStart = chore.occurrence_start_date;
    anchorElement.textContent = chore.title;
    document.body.appendChild(anchorElement);
    anchorElement.focus();

    const { container } = await render(
      <ChorePreviewPopover
        anchorElement={anchorElement}
        canManageChores
        chore={chore}
        onClose={noop}
        onPrimaryAction={noop}
        onRebindPreviewTarget={noop}
        onDeleteChore={async () => null}
        onSaveDateChanges={async () => ({ error: null })}
        onSaveTitleTypeChanges={async () => ({ error: null })}
        onSaveNotesChanges={async () => ({ error: null })}
        onSaveRepeatChanges={async () => ({ error: null })}
        selectionKey="1:single:0"
        todayKey="2026-03-11"
      />,
    );

    const popover = container.querySelector('[role="dialog"]');
    expect(popover).not.toBeNull();
    expect(document.activeElement).toBe(popover);
  });

  it("restores focus to the trigger when an outside click closes the preview popover", async () => {
    const chore = createChore();
    const anchorElement = document.createElement("button");
    anchorElement.dataset.chorePreviewId = String(chore.id);
    anchorElement.dataset.chorePreviewStart = chore.occurrence_start_date;
    anchorElement.textContent = chore.title;
    document.body.appendChild(anchorElement);

    const outsideButton = document.createElement("button");
    outsideButton.textContent = "outside";
    document.body.appendChild(outsideButton);

    const onClose = vi.fn();

    await render(
      <ChorePreviewPopover
        anchorElement={anchorElement}
        canManageChores
        chore={chore}
        onClose={onClose}
        onPrimaryAction={noop}
        onRebindPreviewTarget={noop}
        onDeleteChore={async () => null}
        onSaveDateChanges={async () => ({ error: null })}
        onSaveTitleTypeChanges={async () => ({ error: null })}
        onSaveNotesChanges={async () => ({ error: null })}
        onSaveRepeatChanges={async () => ({ error: null })}
        selectionKey="1:single:0"
        todayKey="2026-03-11"
      />,
    );

    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    await act(async () => {
      outsideButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(anchorElement);
  });

  it("offers whole-series delete from a mid-series repeating chore", async () => {
    const chore = createChore({
      is_repeating: true,
      repeat_rule: "week",
      occurrence_start_date: "2026-03-11",
      series_start_date: "2026-03-04",
    });
    const anchorElement = document.createElement("button");
    anchorElement.dataset.chorePreviewId = String(chore.id);
    anchorElement.dataset.chorePreviewStart = chore.occurrence_start_date;
    anchorElement.textContent = chore.title;
    document.body.appendChild(anchorElement);

    const { container } = await render(
      <ChorePreviewPopover
        anchorElement={anchorElement}
        canManageChores
        chore={chore}
        onClose={noop}
        onPrimaryAction={noop}
        onRebindPreviewTarget={noop}
        onDeleteChore={async () => null}
        onSaveDateChanges={async () => ({ error: null })}
        onSaveTitleTypeChanges={async () => ({ error: null })}
        onSaveNotesChanges={async () => ({ error: null })}
        onSaveRepeatChanges={async () => ({ error: null })}
        selectionKey="1:2026-03-11:0"
        todayKey="2026-03-11"
      />,
    );

    const deleteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete chore"]',
    );
    expect(deleteButton).not.toBeNull();

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("All future chores");
    expect(container.textContent).toContain("All chores");
  });

  it("restores focus to the rebound trigger when the original anchor is stale", async () => {
    const staleAnchor = document.createElement("button");
    staleAnchor.dataset.chorePreviewId = "1";
    staleAnchor.dataset.chorePreviewStart = "2026-03-11";
    staleAnchor.textContent = "old";
    document.body.appendChild(staleAnchor);

    const reboundChore = createChore({
      occurrence_start_date: "2026-03-18",
      series_start_date: "2026-03-18",
    });
    const reboundAnchor = document.createElement("button");
    reboundAnchor.dataset.chorePreviewId = String(reboundChore.id);
    reboundAnchor.dataset.chorePreviewStart = reboundChore.occurrence_start_date;
    reboundAnchor.textContent = reboundChore.title;
    document.body.appendChild(reboundAnchor);

    const onClose = vi.fn();

    await render(
      <ChorePreviewPopover
        anchorElement={staleAnchor}
        canManageChores
        chore={reboundChore}
        onClose={onClose}
        onPrimaryAction={noop}
        onRebindPreviewTarget={noop}
        onDeleteChore={async () => null}
        onSaveDateChanges={async () => ({ error: null })}
        onSaveTitleTypeChanges={async () => ({ error: null })}
        onSaveNotesChanges={async () => ({ error: null })}
        onSaveRepeatChanges={async () => ({ error: null })}
        selectionKey="1:2026-03-18:0"
        todayKey="2026-03-11"
      />,
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(reboundAnchor);
  });
});
