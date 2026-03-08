import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes profile, members, household, settings, create household, and sign out for admins", () => {
    expect(getAccountShortcuts(true, false)).toEqual([
      {
        href: "/user/edit",
        label: "Profile",
      },
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/household/edit",
        label: "Household",
      },
      {
        href: "/settings",
        label: "Settings",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });

  it("includes profile, members, settings, create household, and sign out for non-admin members", () => {
    expect(getAccountShortcuts(false, false)).toEqual([
      {
        href: "/user/edit",
        label: "Profile",
      },
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/settings",
        label: "Settings",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });

  it("includes household switching when multiple households are available", () => {
    expect(getAccountShortcuts(false, true)).toEqual([
      {
        href: "/user/edit",
        label: "Profile",
      },
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/settings",
        label: "Settings",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
      {
        href: "/household/select",
        label: "Switch household",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });
});
