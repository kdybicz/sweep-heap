import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

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
    getSessionMock.mockReset();
    getPendingHouseholdInviteByIdAndSecretMock.mockReset();
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

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      redirectUrl: "/household",
      householdId: 11,
      householdName: "Home",
    });
  });

  it("returns conflict when signed-in user belongs to another household", async () => {
    getPendingHouseholdInviteByIdAndSecretMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
    acceptInvitationMock.mockRejectedValue({
      body: {
        code: "USER_IN_OTHER_HOUSEHOLD",
        message: "You already belong to another household",
      },
    });

    const response = await POST(requestWithBody({ invitationId: 12, secret: "invite-secret" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.USER_IN_OTHER_HOUSEHOLD,
      error: "You already belong to another household",
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

  it("starts auto sign-in flow when session email does not match invite", async () => {
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
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.redirectUrl).toBe("string");
    const redirectUrl = new URL(body.redirectUrl, "http://localhost");
    expect(redirectUrl.pathname).toBe("/auth");
    expect(redirectUrl.searchParams.get("email")).toBe("invited@example.com");
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
});
