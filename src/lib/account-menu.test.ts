import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes profile, members, household, settings, and sign out for admins", () => {
    expect(getAccountShortcuts(true)).toEqual([
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
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });

  it("includes profile, members, settings, and sign out for non-admin members", () => {
    expect(getAccountShortcuts(false)).toEqual([
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
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });
});
