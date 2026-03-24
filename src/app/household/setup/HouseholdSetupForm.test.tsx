import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import HouseholdSetupForm from "@/app/household/setup/HouseholdSetupForm";

describe("HouseholdSetupForm", () => {
  it("renders the member chore management option", () => {
    const markup = renderToStaticMarkup(<HouseholdSetupForm />);

    expect(markup).toContain("Allow regular members to add, edit, and delete chores");
    expect(markup).toContain("Owners and admins can always manage chores");
    expect(markup).toContain('type="checkbox"');
  });
});
