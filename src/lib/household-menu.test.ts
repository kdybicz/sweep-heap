import { describe, expect, it } from "vitest";

import { getHouseholdShortcuts } from "@/lib/household-menu";

describe("getHouseholdShortcuts", () => {
  it("includes edit, members, and create actions for household admins", () => {
    expect(getHouseholdShortcuts(true, false)).toEqual([
      {
        href: "/household/edit",
        label: "Edit household",
      },
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
    ]);
  });

  it("includes members and create household for non-admin members", () => {
    expect(getHouseholdShortcuts(false, false)).toEqual([
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
    ]);
  });

  it("includes switching when multiple households are available", () => {
    expect(getHouseholdShortcuts(false, true)).toEqual([
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
      {
        href: "/household/select",
        label: "Switch household",
      },
    ]);
  });
});
