import { beforeEach, describe, expect, it, vi } from "vitest";

const { acceptHouseholdInviteMock, getSessionMock } = vi.hoisted(() => ({
  acceptHouseholdInviteMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  acceptHouseholdInvite: acceptHouseholdInviteMock,
}));

import { GET } from "@/app/api/households/invites/complete/route";

describe("/api/households/invites/complete route", () => {
  beforeEach(() => {
    acceptHouseholdInviteMock.mockReset();
    getSessionMock.mockReset();
  });

  it("redirects to auth when invite params are missing", async () => {
    const response = await GET(new Request("http://localhost/api/households/invites/complete"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/auth");
  });

  it("redirects back to invite page when sign-in did not complete", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?identifier=id&token=tok"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?identifier=id&token=tok&error=sign-in",
    );
  });

  it("redirects to household when invite is accepted", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({
      status: "accepted",
      householdId: 11,
      householdName: "Home",
      wasAlreadyMember: false,
    });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?identifier=id&token=tok"),
    );

    expect(acceptHouseholdInviteMock).toHaveBeenCalledTimes(1);
    const acceptArgs = acceptHouseholdInviteMock.mock.calls[0]?.[0];
    expect(acceptArgs).toMatchObject({
      email: "jane@example.com",
      identifier: "id",
      userId: 7,
    });
    expect(acceptArgs.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/household");
  });

  it("redirects back with invalid error when invite cannot be used", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({ status: "invalid_or_expired" });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?identifier=id&token=tok"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?identifier=id&token=tok&error=invalid",
    );
  });

  it("redirects back with other-household error when blocked", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({ status: "belongs_to_other_household" });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?identifier=id&token=tok"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?identifier=id&token=tok&error=other-household",
    );
  });

  it("redirects back with sign-in error on email mismatch", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({
      status: "email_mismatch",
      inviteEmail: "other@example.com",
    });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?identifier=id&token=tok"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?identifier=id&token=tok&error=sign-in",
    );
  });
});
