import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { requirePageActiveHouseholdMock } = vi.hoisted(() => ({
  requirePageActiveHouseholdMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/page-access", () => ({
  requirePageActiveHousehold: requirePageActiveHouseholdMock,
}));

vi.mock("@/app/user/edit/UserDetailsEditForm", () => ({
  default: () => <div data-testid="user-details-edit-form" />,
}));

vi.mock("@/app/user/edit/DeleteAccountForm", () => ({
  default: () => <div data-testid="delete-account-form" />,
}));

import UserEditPage from "@/app/user/edit/page";

describe("UserEditPage", () => {
  it("renders a page-level link back to the board", async () => {
    requirePageActiveHouseholdMock.mockResolvedValue({
      household: { id: 7, timeZone: "UTC" },
      sessionUserEmail: "alex@example.com",
      sessionUserName: "Alex",
    });

    const markup = renderToStaticMarkup(await UserEditPage());

    expect(markup).toContain('data-testid="user-details-edit-form"');
    expect(markup).toContain('data-testid="delete-account-form"');
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
  });
});
