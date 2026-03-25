import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePageHouseholdAdminMock } = vi.hoisted(() => ({
  requirePageHouseholdAdminMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/page-access", () => ({
  requirePageHouseholdAdmin: requirePageHouseholdAdminMock,
}));

vi.mock("@/app/household/edit/HouseholdEditForm", () => ({
  default: () => <div data-testid="household-edit-form" />,
}));

import HouseholdEditPage from "@/app/household/edit/page";

describe("HouseholdEditPage", () => {
  beforeEach(() => {
    requirePageHouseholdAdminMock.mockReset();
    requirePageHouseholdAdminMock.mockResolvedValue({
      household: {
        role: "owner",
        icon: "",
        membersCanManageChores: true,
        name: "Home",
        timeZone: "UTC",
      },
    });
  });

  it("renders the refreshed household settings shell", async () => {
    const markup = renderToStaticMarkup(await HouseholdEditPage());

    expect(requirePageHouseholdAdminMock).toHaveBeenCalledOnce();
    expect(markup).toContain('data-testid="household-edit-form"');
    expect(markup).toContain("Edit household");
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
  });
});
