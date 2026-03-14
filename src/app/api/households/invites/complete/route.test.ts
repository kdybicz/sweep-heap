import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acceptInvitationMock,
  getPendingHouseholdInviteByIdAndSecretMock,
  getSessionMock,
  setActiveOrganizationMock,
  withHouseholdMutationLockMock,
} = vi.hoisted(() => ({
  acceptInvitationMock: vi.fn(),
  getPendingHouseholdInviteByIdAndSecretMock: vi.fn(),
  getSessionMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      acceptInvitation: acceptInvitationMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getPendingHouseholdInviteByIdAndSecret: getPendingHouseholdInviteByIdAndSecretMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import { GET } from "@/app/api/households/invites/complete/route";

describe("/api/households/invites/complete route", () => {
  beforeEach(() => {
    acceptInvitationMock.mockReset();
    setActiveOrganizationMock.mockReset();
    getPendingHouseholdInviteByIdAndSecretMock.mockReset();
    getSessionMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=abc; Path=/; HttpOnly",
        },
      }),
    );
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
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "11",
      },
      headers: expect.any(Headers),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/household");
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
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
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects back with sign-in error when a different account is signed in", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "other@example.com" } });
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

    const response = await GET(
      new Request("http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost/household/invite?invitationId=12&secret=s3cr3t&error=sign-in",
    );
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    expect(acceptInvitationMock).not.toHaveBeenCalled();
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
        code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
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
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
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
        code: "INVITATION_NOT_FOUND",
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
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects to selection recovery when active household switch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
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
      setActiveOrganizationMock.mockRejectedValue(new Error("session update failed"));

      const response = await GET(
        new Request(
          "http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t",
        ),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("http://localhost/household/select");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("redirects to selection recovery when active household switch responds non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
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
      setActiveOrganizationMock.mockResolvedValue(new Response(null, { status: 500 }));

      const response = await GET(
        new Request(
          "http://localhost/api/households/invites/complete?invitationId=12&secret=s3cr3t",
        ),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("http://localhost/household/select");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
