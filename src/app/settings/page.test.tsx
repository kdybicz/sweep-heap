import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/app/settings/AppearanceSettingsForm", () => ({
  default: () => <div data-testid="appearance-settings-form" />,
}));

import SettingsPage from "@/app/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    requirePageActiveHouseholdMock.mockReset();
    requirePageActiveHouseholdMock.mockResolvedValue({ household: { id: 7, timeZone: "UTC" } });
  });

  it("renders the refreshed appearance page with a board return path", async () => {
    const markup = renderToStaticMarkup(await SettingsPage());

    expect(requirePageActiveHouseholdMock).toHaveBeenCalledOnce();
    expect(markup).toContain('data-testid="appearance-settings-form"');
    expect(markup).toContain("Appearance");
    expect(markup).toContain('href="/household"');
    expect(markup).toContain("Back to board");
  });
});
