import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  cancelInvitationMock,
  createInvitationMock,
  listInvitationsMock,
  requireApiHouseholdAdminMock,
  requireApiHouseholdMock,
  sendHouseholdInviteEmailMock,
  setPendingHouseholdInviteSecretHashMock,
  withHouseholdMutationLockMock,
  withResponseHeadersMock,
} = vi.hoisted(() => ({
  cancelInvitationMock: vi.fn(),
  createInvitationMock: vi.fn(),
  listInvitationsMock: vi.fn(),
  requireApiHouseholdAdminMock: vi.fn(),
  requireApiHouseholdMock: vi.fn(),
  sendHouseholdInviteEmailMock: vi.fn(),
  setPendingHouseholdInviteSecretHashMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
  withResponseHeadersMock: vi.fn((response: Response) => response),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      cancelInvitation: cancelInvitationMock,
      createInvitation: createInvitationMock,
      listInvitations: listInvitationsMock,
    },
  },
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHousehold: requireApiHouseholdMock,
  requireApiHouseholdAdmin: requireApiHouseholdAdminMock,
  withResponseHeaders: withResponseHeadersMock,
}));

vi.mock("@/lib/household-invite-email", () => ({
  sendHouseholdInviteEmail: sendHouseholdInviteEmailMock,
}));

vi.mock("@/lib/repositories", () => ({
  setPendingHouseholdInviteSecretHash: setPendingHouseholdInviteSecretHashMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import { DELETE, POST } from "@/app/api/households/members/invites/[inviteId]/route";

const pendingInvite = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 12,
  email: "pending@example.com",
  role: "member",
  status: "pending",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2126-01-09T00:00:00.000Z"),
  ...overrides,
});

describe("/api/households/members/invites/[inviteId] route", () => {
  beforeEach(() => {
    cancelInvitationMock.mockReset();
    createInvitationMock.mockReset();
    listInvitationsMock.mockReset();
    requireApiHouseholdAdminMock.mockReset();
    requireApiHouseholdMock.mockReset();
    sendHouseholdInviteEmailMock.mockReset();
    setPendingHouseholdInviteSecretHashMock.mockReset();
    withHouseholdMutationLockMock.mockClear();
    withResponseHeadersMock.mockClear();

    setPendingHouseholdInviteSecretHashMock.mockResolvedValue(12);

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

  it("POST resends a pending invite", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite()]);
    createInvitationMock.mockResolvedValue(pendingInvite());

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.id).toBe(12);
    expect(createInvitationMock).toHaveBeenCalledTimes(1);
    expect(setPendingHouseholdInviteSecretHashMock).toHaveBeenCalledTimes(1);
    expect(sendHouseholdInviteEmailMock).toHaveBeenCalledTimes(1);
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
    const inviteUrl = sendHouseholdInviteEmailMock.mock.calls[0]?.[0]?.inviteUrl;
    expect(typeof inviteUrl).toBe("string");
    const parsedInviteUrl = new URL(inviteUrl as string);
    expect(parsedInviteUrl.searchParams.get("invitationId")).toBe("12");
    expect(parsedInviteUrl.searchParams.get("secret")).toBeTruthy();
  });

  it("POST preserves owner role when resending", async () => {
    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: { sessionUserName: "Alex", sessionUserEmail: "alex@example.com" },
    });
    listInvitationsMock.mockResolvedValue([pendingInvite({ role: "owner" })]);
    createInvitationMock.mockResolvedValue(pendingInvite({ role: "owner" }));

    const response = await POST(new Request("http://localhost/api/households/members/invites/12"), {
      params: Promise.resolve({ inviteId: "12" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createInvitationMock.mock.calls[0]?.[0]?.body?.role).toBe("owner");
    expect(body.invite.role).toBe("owner");
  });

  it("POST blocks non-owners from resending owner invite", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite({ role: "owner" })]);

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
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("POST rejects invalid invite id", async () => {
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
  });

  it("DELETE revokes pending invite for admins", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite()]);
    cancelInvitationMock.mockResolvedValue({});

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, revokedInviteId: 12 });
    expect(cancelInvitationMock).toHaveBeenCalledTimes(1);
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
  });

  it("DELETE blocks admins from revoking owner invites", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite({ role: "owner" })]);

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
    expect(cancelInvitationMock).not.toHaveBeenCalled();
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
  });

  it("DELETE maps missing invite to 404", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite()]);
    cancelInvitationMock.mockRejectedValue({
      body: {
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found",
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/households/members/invites/12"),
      {
        params: Promise.resolve({ inviteId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
      error: "Pending invite not found",
    });
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
  });

  it("POST preserves reconciliation headers on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      listInvitationsMock.mockResolvedValue([pendingInvite()]);
      createInvitationMock.mockRejectedValue(new Error("resend failed"));

      const response = await POST(
        new Request("http://localhost/api/households/members/invites/12"),
        {
          params: Promise.resolve({ inviteId: "12" }),
        },
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to resend household invite",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
