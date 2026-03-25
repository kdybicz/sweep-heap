import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import HouseholdSelectionList from "@/app/household/select/HouseholdSelectionList";

describe("HouseholdSelectionList", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders the refreshed household selection list", () => {
    const markup = renderToStaticMarkup(
      <HouseholdSelectionList
        households={[
          { id: 7, icon: "🧺", name: "Home", role: "owner", timeZone: "UTC" },
          { id: 8, icon: null, name: "Cabin", role: "member", timeZone: "Europe/Warsaw" },
        ]}
      />,
    );

    expect(markup).toContain("Available households");
    expect(markup).toContain("Home");
    expect(markup).toContain("Cabin");
    expect(markup).toContain("Open");
  });
});
