import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes only personal shortcuts", () => {
    expect(getAccountShortcuts()).toEqual([
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
