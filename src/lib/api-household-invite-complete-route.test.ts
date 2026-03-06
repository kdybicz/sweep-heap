import { beforeEach, describe, expect, it, vi } from "vitest";

const { acceptInvitationMock, getPendingHouseholdInviteByIdAndSecretMock, getSessionMock } =
  vi.hoisted(() => ({
    acceptInvitationMock: vi.fn(),
    getPendingHouseholdInviteByIdAndSecretMock: vi.fn(),
    getSessionMock: vi.fn(),
  }));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      acceptInvitation: acceptInvitationMock,
    },
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getPendingHouseholdInviteByIdAndSecret: getPendingHouseholdInviteByIdAndSecretMock,
}));

import { GET } from "@/app/api/households/invites/complete/route";

describe("/api/households/invites/complete route", () => {
  beforeEach(() => {
    acceptInvitationMock.mockReset();
    getPendingHouseholdInviteByIdAndSecretMock.mockReset();
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
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=sign-in",
    );
  });

  it("redirects to household when invite is accepted", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      invitedByUserId: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2126-01-08T00:00:00.000Z"),
    });
    acceptInvitationMock.mockResolvedValue({});

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(getPendingHouseholdInviteByIdAndSecretMock).toHaveBeenCalledTimes(1);
    expect(getPendingHouseholdInviteByIdAndSecretMock.mock.calls[0]?.[0]).toMatchObject({
      inviteId: 12,
      secretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(acceptInvitationMock).toHaveBeenCalledTimes(1);
    const acceptArgs = acceptInvitationMock.mock.calls[0]?.[0];
    expect(acceptArgs).toMatchObject({
      body: {
        invitationId: "12",
      },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/household");
  });

  it("redirects back with invalid error when invite cannot be used", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=invalid",
    );
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("redirects back with other-household error when blocked", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      invitedByUserId: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2126-01-08T00:00:00.000Z"),
    });
    acceptInvitationMock.mockRejectedValue({
      body: {
        message: "You already belong to another household",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=other-household",
    );
  });

  it("redirects back with sign-in error on email mismatch", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      invitedByUserId: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2126-01-08T00:00:00.000Z"),
    });
    acceptInvitationMock.mockRejectedValue({
      body: {
        message: "You are not the recipient of the invitation",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=sign-in",
    );
  });

  it("redirects back with invalid error when invite is no longer pending", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "jane@example.com" } });
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      invitedByUserId: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2126-01-08T00:00:00.000Z"),
    });
    acceptInvitationMock.mockRejectedValue({
      body: {
        message: "Invitation not found",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=invalid",
    );
  });
});
