import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import HouseholdMembersView from "@/app/household/members/HouseholdMembersView";

describe("HouseholdMembersView", () => {
  it("renders a visible actions menu trigger for members rows", () => {
    const markup = renderToStaticMarkup(
      <HouseholdMembersView
        canAdministerMembers={true}
        initialMembers={[
          {
            userId: 7,
            name: "Owner",
            email: "owner@example.com",
            role: "owner",
            joinedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            userId: 9,
            name: "Taylor",
            email: "taylor@example.com",
            role: "member",
            joinedAt: "2026-01-02T00:00:00.000Z",
          },
        ]}
        initialPendingInvites={[]}
        viewerUserId={7}
      />,
    );

    expect(markup).toContain("Open member actions");
  });

  it("renders disabled actions menu trigger when no member actions are available", () => {
    const markup = renderToStaticMarkup(
      <HouseholdMembersView
        canAdministerMembers={false}
        initialMembers={[
          {
            userId: 7,
            name: "Viewer",
            email: "viewer@example.com",
            role: "member",
            joinedAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
        initialPendingInvites={[]}
        viewerUserId={7}
      />,
    );

    expect(markup).toMatch(/Open member actions/);
    expect(markup).toMatch(/disabled=""/);
  });
});
