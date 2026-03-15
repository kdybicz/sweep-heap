import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const {
  isHouseholdMemberInviteNotFoundErrorMock,
  mapHouseholdMemberInviteNotFoundFailureMock,
  requireApiHouseholdAdminMock,
  requireApiHouseholdMock,
  resendHouseholdInviteMock,
  revokeHouseholdInviteMock,
} = vi.hoisted(() => ({
  isHouseholdMemberInviteNotFoundErrorMock: vi.fn(),
  mapHouseholdMemberInviteNotFoundFailureMock: vi.fn(),
  requireApiHouseholdAdminMock: vi.fn(),
  requireApiHouseholdMock: vi.fn(),
  resendHouseholdInviteMock: vi.fn(),
  revokeHouseholdInviteMock: vi.fn(),
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHousehold: requireApiHouseholdMock,
  requireApiHouseholdAdmin: requireApiHouseholdAdminMock,
}));

vi.mock("@/lib/services", () => ({
  isHouseholdMemberInviteNotFoundError: isHouseholdMemberInviteNotFoundErrorMock,
  mapHouseholdMemberInviteNotFoundFailure: mapHouseholdMemberInviteNotFoundFailureMock,
  resendHouseholdInvite: resendHouseholdInviteMock,
  revokeHouseholdInvite: revokeHouseholdInviteMock,
}));

import { DELETE, POST } from "@/app/api/households/members/invites/[inviteId]/route";

describe("/api/households/members/invites/[inviteId] route", () => {
  beforeEach(() => {
    isHouseholdMemberInviteNotFoundErrorMock.mockReset();
    mapHouseholdMemberInviteNotFoundFailureMock.mockReset();
    requireApiHouseholdAdminMock.mockReset();
    requireApiHouseholdMock.mockReset();
    resendHouseholdInviteMock.mockReset();
    revokeHouseholdInviteMock.mockReset();

    isHouseholdMemberInviteNotFoundErrorMock.mockReturnValue(false);
    mapHouseholdMemberInviteNotFoundFailureMock.mockReturnValue({
      ok: false,
      status: 404,
      code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
      error: "Pending invite not found",
    });

    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "member" },
      sessionContext: { sessionUserName: "Alex", sessionUserEmail: "alex@example.com" },
    });
    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "admin" },
      sessionContext: { userId: 7 },
    });
  });

  it("POST delegates invite resend to the service", async () => {
    resendHouseholdInviteMock.mockResolvedValue({
      ok: true,
      data: {
        invite: {
          id: 12,
          email: "pending@example.com",
          role: "member",
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2126-01-09T00:00:00.000Z",
        },
        inviteEmailSent: true,
      },
    });

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invite.id).toBe(12);
    expect(resendHouseholdInviteMock).toHaveBeenCalledWith({
      actorRole: "member",
      householdId: 11,
      householdName: "Home",
      inviteId: 12,
      inviterName: "Alex",
      request: expect.any(Request),
    });
  });

  it("POST returns service failures", async () => {
    resendHouseholdInviteMock.mockResolvedValue({
      ok: false,
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  });

  it("DELETE delegates invite revoke to the service", async () => {
    revokeHouseholdInviteMock.mockResolvedValue({
      ok: true,
      data: {
        revokedInviteId: 12,
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, revokedInviteId: 12 });
    expect(revokeHouseholdInviteMock).toHaveBeenCalledWith({
      actorRole: "admin",
      householdId: 11,
      inviteId: 12,
      requestHeaders: expect.any(Headers),
    });
  });

  it("maps invite-not-found errors from the service helper", async () => {
    const error = new Error("invite missing");
    resendHouseholdInviteMock.mockRejectedValue(error);
    isHouseholdMemberInviteNotFoundErrorMock.mockReturnValue(true);

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
      error: "Pending invite not found",
    });
    expect(mapHouseholdMemberInviteNotFoundFailureMock).toHaveBeenCalled();
  });

  it("rejects invalid invite ids before calling the service", async () => {
    const response = await POST(
      new Request("http://localhost/api/households/members/invites/not-a-number"),
      {
        params: Promise.resolve({ inviteId: "not-a-number" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Invite id is required",
    });
    expect(resendHouseholdInviteMock).not.toHaveBeenCalled();
  });
});
