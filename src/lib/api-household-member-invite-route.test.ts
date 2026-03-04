import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActiveHouseholdSummaryMock,
  getSessionMock,
  resendPendingHouseholdInviteMock,
  revokePendingHouseholdInviteMock,
  sendHouseholdInviteEmailMock,
} = vi.hoisted(() => ({
  getActiveHouseholdSummaryMock: vi.fn(),
  getSessionMock: vi.fn(),
  resendPendingHouseholdInviteMock: vi.fn(),
  revokePendingHouseholdInviteMock: vi.fn(),
  sendHouseholdInviteEmailMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getActiveHouseholdSummary: getActiveHouseholdSummaryMock,
  resendPendingHouseholdInvite: resendPendingHouseholdInviteMock,
  revokePendingHouseholdInvite: revokePendingHouseholdInviteMock,
}));

vi.mock("@/lib/household-invite-email", () => ({
  sendHouseholdInviteEmail: sendHouseholdInviteEmailMock,
}));

import { DELETE, POST } from "@/app/api/households/members/invites/[inviteId]/route";

describe("/api/households/members/invites/[inviteId] route", () => {
  beforeEach(() => {
    getActiveHouseholdSummaryMock.mockReset();
    getSessionMock.mockReset();
    resendPendingHouseholdInviteMock.mockReset();
    revokePendingHouseholdInviteMock.mockReset();
    sendHouseholdInviteEmailMock.mockReset();
  });

  it("POST resends a pending invite", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7", name: "Alex", email: "alex@example.com" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      role: "member",
      timeZone: "UTC",
      icon: null,
    });
    resendPendingHouseholdInviteMock.mockResolvedValue({
      id: 12,
      householdId: 11,
      householdName: "Home",
      email: "pending@example.com",
      role: "member",
      invitedByUserId: 7,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-09T00:00:00.000Z"),
    });

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.email).toBe("pending@example.com");
    expect(sendHouseholdInviteEmailMock).toHaveBeenCalledTimes(1);
    expect(resendPendingHouseholdInviteMock).toHaveBeenCalledTimes(1);
  });

  it("POST rejects unauthenticated users", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
    expect(resendPendingHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("POST rejects invalid invite ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      role: "member",
      timeZone: "UTC",
      icon: null,
    });

    const response = await POST(
      new Request("http://localhost/api/households/members/invites/not-a-number"),
      {
        params: Promise.resolve({ inviteId: "not-a-number" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invite id is required" });
    expect(resendPendingHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("POST returns household required when user has no active household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "Household required" });
    expect(resendPendingHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("DELETE forbids non-admin revoke", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      role: "member",
      timeZone: "UTC",
      icon: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, error: "Forbidden" });
    expect(revokePendingHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("DELETE rejects unauthenticated users", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
    expect(revokePendingHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("DELETE revokes pending invite for admins", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      role: "admin",
      timeZone: "UTC",
      icon: null,
    });
    revokePendingHouseholdInviteMock.mockResolvedValue(12);

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, revokedInviteId: 12 });
    expect(revokePendingHouseholdInviteMock).toHaveBeenCalledWith({
      householdId: 11,
      inviteId: 12,
    });
  });
});
