import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { requirePageSessionUserMock, resolveActiveHouseholdMock } = vi.hoisted(() => ({
  requirePageSessionUserMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/page-access", () => ({
  requirePageSessionUser: requirePageSessionUserMock,
}));

vi.mock("@/lib/services", () => ({
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

vi.mock("@/app/household/setup/HouseholdSetupForm", () => ({
  default: () => <div data-testid="household-setup-form" />,
}));

import HouseholdSetupPage from "@/app/household/setup/page";

describe("HouseholdSetupPage", () => {
  it("renders a board back link when the user already has an active household", async () => {
    requirePageSessionUserMock.mockResolvedValue({
      sessionActiveHouseholdId: 7,
      userId: 12,
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
    });

    const markup = renderToStaticMarkup(await HouseholdSetupPage());

    expect(resolveActiveHouseholdMock).toHaveBeenCalledWith({
      sessionActiveHouseholdId: 7,
      userId: 12,
    });
    expect(markup).toContain('data-testid="household-setup-form"');
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
  });

  it("renders a selection escape when the user still needs to choose a household", async () => {
    requirePageSessionUserMock.mockResolvedValue({
      sessionActiveHouseholdId: null,
      userId: 12,
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });

    const markup = renderToStaticMarkup(await HouseholdSetupPage());

    expect(markup).toContain('data-testid="household-setup-form"');
    expect(markup).toContain('href="/household/select"');
    expect(markup).toContain("Back to household selection");
  });

  it("hides escape actions during first-household onboarding", async () => {
    requirePageSessionUserMock.mockResolvedValue({
      sessionActiveHouseholdId: null,
      userId: 12,
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "none",
    });

    const markup = renderToStaticMarkup(await HouseholdSetupPage());

    expect(markup).toContain('data-testid="household-setup-form"');
    expect(markup).not.toContain('href="/household"');
    expect(markup).not.toContain('href="/household/select"');
    expect(markup).not.toContain("Back to board");
    expect(markup).not.toContain("Back to household selection");
  });
});
