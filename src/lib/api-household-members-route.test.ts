import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createHouseholdMemberInviteMock,
  getActiveHouseholdSummaryMock,
  getSessionMock,
  listActiveHouseholdMembersMock,
  listPendingHouseholdInvitesMock,
  removeActiveHouseholdMemberWithGuardMock,
  sendHouseholdInviteEmailMock,
  updateActiveHouseholdMemberRoleWithGuardMock,
} = vi.hoisted(() => ({
  createHouseholdMemberInviteMock: vi.fn(),
  getActiveHouseholdSummaryMock: vi.fn(),
  getSessionMock: vi.fn(),
  listActiveHouseholdMembersMock: vi.fn(),
  listPendingHouseholdInvitesMock: vi.fn(),
  removeActiveHouseholdMemberWithGuardMock: vi.fn(),
  sendHouseholdInviteEmailMock: vi.fn(),
  updateActiveHouseholdMemberRoleWithGuardMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  createHouseholdMemberInvite: createHouseholdMemberInviteMock,
  getActiveHouseholdSummary: getActiveHouseholdSummaryMock,
  listActiveHouseholdMembers: listActiveHouseholdMembersMock,
  listPendingHouseholdInvites: listPendingHouseholdInvitesMock,
  removeActiveHouseholdMemberWithGuard: removeActiveHouseholdMemberWithGuardMock,
  updateActiveHouseholdMemberRoleWithGuard: updateActiveHouseholdMemberRoleWithGuardMock,
}));

vi.mock("@/lib/household-invite-email", () => ({
  sendHouseholdInviteEmail: sendHouseholdInviteEmailMock,
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
    getActiveHouseholdSummaryMock.mockReset();
    getSessionMock.mockReset();
    listActiveHouseholdMembersMock.mockReset();
    listPendingHouseholdInvitesMock.mockReset();
    removeActiveHouseholdMemberWithGuardMock.mockReset();
    sendHouseholdInviteEmailMock.mockReset();
    updateActiveHouseholdMemberRoleWithGuardMock.mockReset();
  });

  it("GET returns household members for authenticated members", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "member",
    });
    listActiveHouseholdMembersMock.mockResolvedValue([
      {
        userId: 7,
        name: "Jane",
        email: "jane@example.com",
        role: "member",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    listPendingHouseholdInvitesMock.mockResolvedValue([
      {
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "pending@example.com",
        role: "member",
        invitedByUserId: 7,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        expiresAt: new Date("2026-01-10T00:00:00.000Z"),
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.canAdministerMembers).toBe(false);
    expect(body.viewerUserId).toBe(7);
    expect(body.members).toHaveLength(1);
    expect(body.pendingInvites).toHaveLength(1);
    expect(listActiveHouseholdMembersMock).toHaveBeenCalledWith(11);
    expect(listPendingHouseholdInvitesMock).toHaveBeenCalledWith(11);
  });

  it("GET returns household required when user has no active household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "Household required" });
  });

  it("GET returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "7" } });
      getActiveHouseholdSummaryMock.mockResolvedValue({
        id: 11,
        name: "Home",
        timeZone: "UTC",
        icon: null,
        role: "admin",
      });
      listActiveHouseholdMembersMock.mockRejectedValue(new Error("db failed"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to load household members" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST creates invite token and sends invitation email", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7", name: "Alex", email: "alex@example.com" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "member",
    });
    createHouseholdMemberInviteMock.mockResolvedValue({
      status: "invited",
      invite: {
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "new@example.com",
        role: "member",
        invitedByUserId: 7,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });

    const response = await POST(
      requestWithBody("POST", {
        email: "  NEW@example.com  ",
      }),
    );
    const body = await response.json();

    expect(createHouseholdMemberInviteMock).toHaveBeenCalledTimes(1);
    const inviteArgs = createHouseholdMemberInviteMock.mock.calls[0]?.[0];
    expect(inviteArgs).toMatchObject({
      householdId: 11,
      email: "new@example.com",
      invitedByUserId: 7,
      role: "member",
    });
    expect(inviteArgs.expiresAt).toBeInstanceOf(Date);
    expect(inviteArgs.identifier).toMatch(/^household-invite-11-[A-Za-z0-9_-]+$/);
    expect(inviteArgs.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(sendHouseholdInviteEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendHouseholdInviteEmailMock.mock.calls[0]?.[0];
    expect(emailArgs.to).toBe("new@example.com");
    expect(emailArgs.householdName).toBe("Home");
    expect(emailArgs.inviterName).toBe("Alex");
    const inviteUrl = new URL(emailArgs.inviteUrl);
    expect(inviteUrl.pathname).toBe("/household/invite");
    expect(inviteUrl.searchParams.get("identifier")).toBe(inviteArgs.identifier);
    expect(inviteUrl.searchParams.get("token")).toBeTruthy();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      invite: {
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "new@example.com",
        role: "member",
        invitedByUserId: 7,
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
      },
      inviteEmailSent: true,
    });
  });

  it("POST rejects users already in another household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "member",
    });
    createHouseholdMemberInviteMock.mockResolvedValue({
      status: "belongs_to_other_household",
    });

    const response = await POST(
      requestWithBody("POST", {
        email: "new@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "User already belongs to another household",
    });
  });

  it("POST rejects when invite already pending", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "member",
    });
    createHouseholdMemberInviteMock.mockResolvedValue({
      status: "already_invited",
      invite: {
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "new@example.com",
        role: "member",
        invitedByUserId: 7,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });

    const response = await POST(
      requestWithBody("POST", {
        email: "new@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      existingInvite: {
        id: 12,
        householdId: 11,
        householdName: "Home",
        email: "new@example.com",
        role: "member",
        invitedByUserId: 7,
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("PATCH rejects non-admin users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "member",
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        userId: 3,
        role: "admin",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "Forbidden" });
    expect(updateActiveHouseholdMemberRoleWithGuardMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects attempts to change your own role", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "admin",
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        userId: 5,
        role: "member",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "Admins cannot change their own role",
    });
  });

  it("DELETE rejects attempts to remove yourself", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "admin",
    });

    const response = await DELETE(
      requestWithBody("DELETE", {
        userId: 5,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "Admins cannot remove themselves",
    });
    expect(removeActiveHouseholdMemberWithGuardMock).not.toHaveBeenCalled();
  });

  it("PATCH prevents demoting the last admin", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "admin",
    });
    updateActiveHouseholdMemberRoleWithGuardMock.mockResolvedValue({
      status: "last_admin",
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        userId: 9,
        role: "member",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "At least one admin must remain in the household",
    });
    expect(updateActiveHouseholdMemberRoleWithGuardMock).toHaveBeenCalledWith({
      householdId: 11,
      userId: 9,
      role: "member",
    });
  });

  it("PATCH returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "5" } });
      getActiveHouseholdSummaryMock.mockResolvedValue({
        id: 11,
        name: "Home",
        timeZone: "UTC",
        icon: null,
        role: "admin",
      });
      updateActiveHouseholdMemberRoleWithGuardMock.mockRejectedValue(new Error("db failed"));

      const response = await PATCH(
        requestWithBody("PATCH", {
          userId: 9,
          role: "member",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to update member role" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("DELETE prevents removing the last admin", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "admin",
    });
    removeActiveHouseholdMemberWithGuardMock.mockResolvedValue({
      status: "last_admin",
    });

    const response = await DELETE(
      requestWithBody("DELETE", {
        userId: 9,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "At least one admin must remain in the household",
    });
    expect(removeActiveHouseholdMemberWithGuardMock).toHaveBeenCalledWith({
      householdId: 11,
      userId: 9,
    });
  });

  it("DELETE removes a household member for admins", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "5" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      role: "admin",
    });
    removeActiveHouseholdMemberWithGuardMock.mockResolvedValue({
      status: "removed",
      userId: 9,
    });

    const response = await DELETE(
      requestWithBody("DELETE", {
        userId: 9,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, removedUserId: 9 });
    expect(removeActiveHouseholdMemberWithGuardMock).toHaveBeenCalledWith({
      householdId: 11,
      userId: 9,
    });
  });
});
