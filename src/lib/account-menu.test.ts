import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes profile, household edit, and sign out for admins", () => {
    expect(getAccountShortcuts(true)).toEqual([
      {
        href: "/user/edit",
        label: "Edit profile",
      },
      {
        href: "/household/edit",
        label: "Edit household",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });

  it("includes profile and sign out for non-admin members", () => {
    expect(getAccountShortcuts(false)).toEqual([
      {
        href: "/user/edit",
        label: "Edit profile",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });
});
