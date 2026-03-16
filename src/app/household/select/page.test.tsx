import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { requirePageHouseholdSelectionMock } = vi.hoisted(() => ({
  requirePageHouseholdSelectionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/page-access", () => ({
  requirePageHouseholdSelection: requirePageHouseholdSelectionMock,
}));

vi.mock("@/app/household/select/HouseholdSelectionList", () => ({
  default: ({ households }: { households: Array<{ id: number; name: string }> }) => (
    <div data-testid="household-selection-list">
      {households.map((household) => household.name).join(", ")}
    </div>
  ),
}));

import HouseholdSelectPage from "@/app/household/select/page";

describe("HouseholdSelectPage", () => {
  it("renders a back link when the user is switching from an active household", async () => {
    requirePageHouseholdSelectionMock.mockResolvedValue({
      householdResolution: {
        status: "resolved",
        source: "session",
        household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
      },
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });

    const markup = renderToStaticMarkup(await HouseholdSelectPage());

    expect(markup).toContain('data-testid="household-selection-list"');
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
  });

  it("hides the back link when the user must choose a household", async () => {
    requirePageHouseholdSelectionMock.mockResolvedValue({
      householdResolution: {
        status: "selection-required",
        households: [
          { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
          { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
        ],
      },
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });

    const markup = renderToStaticMarkup(await HouseholdSelectPage());

    expect(markup).toContain('data-testid="household-selection-list"');
    expect(markup).not.toContain('href="/household"');
    expect(markup).not.toContain("Back to board");
  });
});
