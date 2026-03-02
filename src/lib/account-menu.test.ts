import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes profile, household, settings, and sign out for admins", () => {
    expect(getAccountShortcuts(true)).toEqual([
      {
        href: "/user/edit",
        label: "Profile",
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

  it("includes profile, settings, and sign out for non-admin members", () => {
    expect(getAccountShortcuts(false)).toEqual([
      {
        href: "/user/edit",
        label: "Profile",
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
