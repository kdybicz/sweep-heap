import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import HouseholdEditForm from "@/app/household/edit/HouseholdEditForm";

describe("HouseholdEditForm", () => {
  it("renders the member chore management option", () => {
    const markup = renderToStaticMarkup(
      <HouseholdEditForm
        canDeleteHousehold={false}
        initialIcon="🏡"
        initialMembersCanManageChores={false}
        initialName="Home"
        initialTimeZone="UTC"
      />,
    );

    expect(markup).toContain("Allow regular members to add, edit, and delete chores");
    expect(markup).toContain("Owners and admins can always manage chores");
    expect(markup).toContain('type="checkbox"');
  });
});
