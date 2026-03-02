import { describe, expect, it } from "vitest";

import { getAccountShortcuts } from "@/lib/account-menu";

describe("getAccountShortcuts", () => {
  it("includes edit household for admins", () => {
    expect(getAccountShortcuts(true)).toEqual([
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

  it("keeps only sign out for non-admin members", () => {
    expect(getAccountShortcuts(false)).toEqual([
      {
        href: "/signout",
        label: "Sign out",
      },
    ]);
  });
});
