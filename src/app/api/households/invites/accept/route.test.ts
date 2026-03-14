import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

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

import { POST } from "@/app/api/households/invites/accept/route";

const requestWithBody = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/invites/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const requestWithRawBody = (rawBody: string) =>
  new Request("http://localhost/api/households/invites/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });

describe("/api/households/invites/accept route", () => {
  beforeEach(() => {
    acceptInvitationMock.mockReset();
    setActiveOrganizationMock.mockReset();
    getSessionMock.mockReset();
    getPendingHouseholdInviteByIdAndSecretMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=abc; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("rejects missing invitation id or secret", async () => {
    const response = await POST(requestWithBody({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Invitation id and secret are required",
    });
    expect(getPendingHouseholdInviteByIdAndSecretMock).not.toHaveBeenCalled();
  });

  it("rejects non-object json payloads", async () => {
    const response = await POST(requestWithRawBody("[]"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_JSON_BODY,
      error: "Invalid JSON body",
    });
    expect(getPendingHouseholdInviteByIdAndSecretMock).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired invites", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue(null);

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_INVITE,
      error: "Invalid or expired invite",
    });
    expect(acceptInvitationMock).not.toHaveBeenCalled();
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it("accepts invite immediately for signed-in invited user", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
    acceptInvitationMock.mockResolvedValue({});

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

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

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
    expect(body).toEqual({
      ok: true,
      redirectUrl: "/household",
      householdId: 11,
      householdName: "Home",
      activeHouseholdActivated: true,
    });
  });

  it("keeps invite acceptance successful for users who already belong to another household", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
    acceptInvitationMock.mockResolvedValue({});

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      redirectUrl: "/household",
      householdId: 11,
      householdName: "Home",
      activeHouseholdActivated: true,
    });
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "11",
      },
      headers: expect.any(Headers),
    });
  });

  it("starts auto sign-in flow when no session exists", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "invited@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue(null);

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(acceptInvitationMock).not.toHaveBeenCalled();
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.redirectUrl).toBe("string");
    const redirectUrl = new URL(body.redirectUrl, "http://localhost");
    expect(redirectUrl.pathname).toBe("/auth");
    expect(redirectUrl.searchParams.get("email")).toBe("invited@example.com");
    expect(redirectUrl.searchParams.get("callbackURL")).toBe(
      "/api/households/invites/complete?invitationId=12&secret=invite-secret",
    );
  });

  it("starts switch-account flow when a different account is already signed in", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "invited@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "other@example.com" } });

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(acceptInvitationMock).not.toHaveBeenCalled();
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.redirectUrl).toBe("string");
    const redirectUrl = new URL(body.redirectUrl, "http://localhost");
    expect(redirectUrl.pathname).toBe("/household/invite");
    expect(redirectUrl.searchParams.get("invitationId")).toBe("12");
    expect(redirectUrl.searchParams.get("secret")).toBe("invite-secret");
    expect(redirectUrl.searchParams.get("error")).toBe("sign-in");
  });

  it("starts switch-account flow when accept detects a recipient mismatch", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "invited@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "invited@example.com" } });
    acceptInvitationMock.mockRejectedValue({
      body: {
        code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
        message: "You are not the recipient of the invitation",
      },
    });

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    const redirectUrl = new URL(body.redirectUrl, "http://localhost");
    expect(redirectUrl.pathname).toBe("/household/invite");
    expect(redirectUrl.searchParams.get("error")).toBe("sign-in");
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getPendingHouseholdInviteByIdAndSecretMock.mockRejectedValue(new Error("db failed"));

      const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to accept household invite",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns recoverable selection redirect when active household switch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "jane@example.com",
        role: "member",
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
      acceptInvitationMock.mockResolvedValue({});
      setActiveOrganizationMock.mockRejectedValue(new Error("session update failed"));

      const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        redirectUrl: "/household/select",
        householdId: 11,
        householdName: "Home",
        activeHouseholdActivated: false,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Accepted household invite but failed to activate household",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns recoverable selection redirect when active household switch responds non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "jane@example.com",
        role: "member",
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
      acceptInvitationMock.mockResolvedValue({});
      setActiveOrganizationMock.mockResolvedValue(new Response(null, { status: 500 }));

      const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        redirectUrl: "/household/select",
        householdId: 11,
        householdName: "Home",
        activeHouseholdActivated: false,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Accepted household invite but failed to activate household",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
