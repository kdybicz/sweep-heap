import { describe, expect, it, vi } from "vitest";

import {
  closeDetailsDropdown,
  closePeerDetailsDropdowns,
  DETAILS_DROPDOWN_GROUP_ATTRIBUTE,
} from "@/app/household/board/components/useDetailsDropdown";

type FakeDetailsDropdown = {
  open: boolean;
  groupName: string;
  focus: ReturnType<typeof vi.fn>;
  contains: (target: Node | null) => boolean;
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => { focus: () => void } | null;
};

const createDetailsDropdown = ({ open, groupName }: { open: boolean; groupName: string }) => {
  const focus = vi.fn();

  const detailsDropdown: FakeDetailsDropdown = {
    open,
    groupName,
    focus,
    contains: () => false,
    getAttribute: (name) =>
      name === DETAILS_DROPDOWN_GROUP_ATTRIBUTE ? detailsDropdown.groupName : null,
    querySelector: (selector) => (selector === "summary" ? { focus } : null),
  };

  return detailsDropdown;
};

describe("useDetailsDropdown helpers", () => {
  it("closes open peer dropdowns in the same group", () => {
    const current = createDetailsDropdown({ open: true, groupName: "header" });
    const sameGroupPeer = createDetailsDropdown({ open: true, groupName: "header" });
    const otherGroupPeer = createDetailsDropdown({ open: true, groupName: "sidebar" });

    closePeerDetailsDropdowns(current, [current, sameGroupPeer, otherGroupPeer]);

    expect(current.open).toBe(true);
    expect(sameGroupPeer.open).toBe(false);
    expect(otherGroupPeer.open).toBe(true);
  });

  it("restores focus to the summary when closing on escape", () => {
    const detailsDropdown = createDetailsDropdown({ open: true, groupName: "header" });

    const didClose = closeDetailsDropdown(detailsDropdown, { restoreFocus: true });

    expect(didClose).toBe(true);
    expect(detailsDropdown.open).toBe(false);
    expect(detailsDropdown.focus).toHaveBeenCalledTimes(1);
  });

  it("does nothing when asked to close an already closed dropdown", () => {
    const detailsDropdown = createDetailsDropdown({ open: false, groupName: "header" });

    const didClose = closeDetailsDropdown(detailsDropdown, { restoreFocus: true });

    expect(didClose).toBe(false);
    expect(detailsDropdown.focus).not.toHaveBeenCalled();
  });
});
