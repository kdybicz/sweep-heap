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

describe("HouseholdInviteAcceptanceForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders the refreshed invite acceptance section", async () => {
    const { default: HouseholdInviteAcceptanceForm } = await import(
      "@/app/household/invite/HouseholdInviteAcceptanceForm"
    );

    const markup = renderToStaticMarkup(
      <HouseholdInviteAcceptanceForm
        householdName="Sunday Crew"
        initialError={null}
        invitationId={12}
        secret="invite-secret"
      />,
    );

    expect(markup).toContain("Accept household invite");
    expect(markup).toContain("Sunday Crew");
    expect(markup).toContain("Accept invite");
  });
});
