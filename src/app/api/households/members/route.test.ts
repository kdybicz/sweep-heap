import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const {
  createHouseholdMemberInviteMock,
  getHouseholdMembersSnapshotMock,
  removeHouseholdMemberMock,
  requireApiHouseholdAdminMock,
  requireApiHouseholdMock,
  updateHouseholdMemberRoleMock,
} = vi.hoisted(() => ({
  createHouseholdMemberInviteMock: vi.fn(),
  getHouseholdMembersSnapshotMock: vi.fn(),
  removeHouseholdMemberMock: vi.fn(),
  requireApiHouseholdAdminMock: vi.fn(),
  requireApiHouseholdMock: vi.fn(),
  updateHouseholdMemberRoleMock: vi.fn(),
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHousehold: requireApiHouseholdMock,
  requireApiHouseholdAdmin: requireApiHouseholdAdminMock,
}));

vi.mock("@/lib/household-members", () => ({
  getHouseholdMembersSnapshot: getHouseholdMembersSnapshotMock,
}));

vi.mock("@/lib/services", () => ({
  createHouseholdMemberInvite: createHouseholdMemberInviteMock,
  removeHouseholdMember: removeHouseholdMemberMock,
  updateHouseholdMemberRole: updateHouseholdMemberRoleMock,
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/households/members/route";

const requestWithBody = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/members", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/households/members route", () => {
  beforeEach(() => {
    createHouseholdMemberInviteMock.mockReset();
    getHouseholdMembersSnapshotMock.mockReset();
    removeHouseholdMemberMock.mockReset();
    requireApiHouseholdAdminMock.mockReset();
    requireApiHouseholdMock.mockReset();
    updateHouseholdMemberRoleMock.mockReset();

    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "member" },
      sessionContext: {
        userId: 7,
        sessionUserName: "Alex",
        sessionUserEmail: "alex@example.com",
      },
    });
    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "admin" },
      sessionContext: {
        userId: 7,
      },
    });
  });

  it("GET returns mapped members and pending invites", async () => {
    getHouseholdMembersSnapshotMock.mockResolvedValue({
      members: [
        {
          userId: 7,
          name: "Jane",
          email: "jane@example.com",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      pendingInvites: [
        {
          id: 12,
          email: "pending@example.com",
          role: "member",
          createdAt: "2026-01-03T00:00:00.000Z",
          expiresAt: "2126-01-10T00:00:00.000Z",
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/households/members"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      household: { id: 11, name: "Home", role: "member" },
      viewerUserId: 7,
      canAdministerMembers: false,
      members: [
        {
          userId: 7,
          name: "Jane",
          email: "jane@example.com",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      pendingInvites: [
        {
          id: 12,
          email: "pending@example.com",
          role: "member",
          createdAt: "2026-01-03T00:00:00.000Z",
          expiresAt: "2126-01-10T00:00:00.000Z",
        },
      ],
    });
    expect(getHouseholdMembersSnapshotMock).toHaveBeenCalledWith({
      householdId: 11,
      requestHeaders: expect.any(Headers),
    });
  });

  it("POST delegates invite creation to the service", async () => {
    createHouseholdMemberInviteMock.mockResolvedValue({
      ok: true,
      data: {
        invite: {
          id: 12,
          email: "new@example.com",
          role: "member",
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-08T00:00:00.000Z",
        },
        inviteEmailSent: true,
      },
    });

    const response = await POST(requestWithBody("POST", { email: "NEW@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.id).toBe(12);
    expect(body.inviteEmailSent).toBe(true);
    expect(createHouseholdMemberInviteMock).toHaveBeenCalledWith({
      email: "new@example.com",
      householdId: 11,
      householdName: "Home",
      inviterName: "Alex",
      request: expect.any(Request),
    });
  });

  it("POST returns service-level invite conflicts", async () => {
    createHouseholdMemberInviteMock.mockResolvedValue({
      ok: false,
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_INVITED,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      existingInvite: {
        id: 12,
        email: "new@example.com",
        role: "member",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z",
      },
    });

    const response = await POST(requestWithBody("POST", { email: "new@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.USER_ALREADY_INVITED,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      existingInvite: {
        id: 12,
        email: "new@example.com",
        role: "member",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z",
      },
    });
  });

  it("PATCH validates the payload before calling the service", async () => {
    const response = await PATCH(requestWithBody("PATCH", { userId: 7.5, role: "member" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Member user id is required",
    });
    expect(updateHouseholdMemberRoleMock).not.toHaveBeenCalled();
  });

  it("PATCH delegates role updates to the service", async () => {
    updateHouseholdMemberRoleMock.mockResolvedValue({
      ok: true,
      data: {
        member: {
          userId: 9,
          name: "Taylor",
          email: "taylor@example.com",
          role: "owner",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "owner" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      member: {
        userId: 9,
        name: "Taylor",
        email: "taylor@example.com",
        role: "owner",
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(updateHouseholdMemberRoleMock).toHaveBeenCalledWith({
      actorRole: "admin",
      actorUserId: 7,
      householdId: 11,
      nextRole: "owner",
      requestHeaders: expect.any(Headers),
      targetUserId: 9,
    });
  });

  it("DELETE delegates member removal to the service", async () => {
    removeHouseholdMemberMock.mockResolvedValue({
      ok: true,
      data: {
        removedUserId: 9,
      },
    });

    const response = await DELETE(requestWithBody("DELETE", { userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, removedUserId: 9 });
    expect(removeHouseholdMemberMock).toHaveBeenCalledWith({
      actorRole: "admin",
      actorUserId: 7,
      householdId: 11,
      requestHeaders: expect.any(Headers),
      targetUserId: 9,
    });
  });

  it("GET preserves reconciliation headers on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getHouseholdMembersSnapshotMock.mockRejectedValue(new Error("snapshot failed"));

      const response = await GET(new Request("http://localhost/api/households/members"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to load household members",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
