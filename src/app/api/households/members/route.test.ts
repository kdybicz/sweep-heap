import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  createInvitationMock,
  getFullOrganizationMock,
  listInvitationsMock,
  listMembersMock,
  removeMemberMock,
  requireApiHouseholdAdminMock,
  requireApiHouseholdMock,
  sendHouseholdInviteEmailMock,
  setPendingHouseholdInviteSecretHashMock,
  updateMemberRoleMock,
  withHouseholdMutationLockMock,
  withResponseHeadersMock,
} = vi.hoisted(() => ({
  createInvitationMock: vi.fn(),
  getFullOrganizationMock: vi.fn(),
  listInvitationsMock: vi.fn(),
  listMembersMock: vi.fn(),
  removeMemberMock: vi.fn(),
  requireApiHouseholdAdminMock: vi.fn(),
  requireApiHouseholdMock: vi.fn(),
  sendHouseholdInviteEmailMock: vi.fn(),
  setPendingHouseholdInviteSecretHashMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
  withResponseHeadersMock: vi.fn((response: Response) => response),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      createInvitation: createInvitationMock,
      getFullOrganization: getFullOrganizationMock,
      listInvitations: listInvitationsMock,
      listMembers: listMembersMock,
      removeMember: removeMemberMock,
      updateMemberRole: updateMemberRoleMock,
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

import { DELETE, GET, PATCH, POST } from "@/app/api/households/members/route";

const requestWithBody = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/members", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/households/members route", () => {
  beforeEach(() => {
    createInvitationMock.mockReset();
    getFullOrganizationMock.mockReset();
    listInvitationsMock.mockReset();
    listMembersMock.mockReset();
    removeMemberMock.mockReset();
    requireApiHouseholdAdminMock.mockReset();
    requireApiHouseholdMock.mockReset();
    sendHouseholdInviteEmailMock.mockReset();
    setPendingHouseholdInviteSecretHashMock.mockReset();
    withHouseholdMutationLockMock.mockClear();
    withResponseHeadersMock.mockClear();
    updateMemberRoleMock.mockReset();

    setPendingHouseholdInviteSecretHashMock.mockResolvedValue(12);

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
    getFullOrganizationMock.mockResolvedValue({
      members: [
        {
          id: 21,
          userId: 7,
          role: "admin",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          user: { name: "Jane", email: "jane@example.com" },
        },
      ],
      invitations: [
        {
          id: 12,
          email: "pending@example.com",
          role: "member",
          status: "pending",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
          expiresAt: new Date("2126-01-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/households/members"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.viewerUserId).toBe(7);
    expect(body.canAdministerMembers).toBe(false);
    expect(body.members).toEqual([
      {
        userId: 7,
        name: "Jane",
        email: "jane@example.com",
        role: "admin",
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(body.pendingInvites).toEqual([
      {
        id: 12,
        email: "pending@example.com",
        role: "member",
        createdAt: "2026-01-03T00:00:00.000Z",
        expiresAt: "2126-01-10T00:00:00.000Z",
      },
    ]);
  });

  it("GET keeps owner role and grants member administration", async () => {
    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: {
        userId: 7,
        sessionUserName: "Alex",
        sessionUserEmail: "alex@example.com",
      },
    });
    getFullOrganizationMock.mockResolvedValue({
      members: [
        {
          id: 21,
          userId: 7,
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          user: { name: "Jane", email: "jane@example.com" },
        },
      ],
      invitations: [
        {
          id: 12,
          email: "pending@example.com",
          role: "owner",
          status: "pending",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
          expiresAt: new Date("2126-01-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/households/members"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.canAdministerMembers).toBe(true);
    expect(body.members[0]?.role).toBe("owner");
    expect(body.pendingInvites[0]?.role).toBe("owner");
  });

  it("POST creates invite and sends invitation email", async () => {
    createInvitationMock.mockResolvedValue({
      id: 12,
      email: "new@example.com",
      role: "member",
      status: "pending",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-08T00:00:00.000Z"),
    });

    const response = await POST(requestWithBody("POST", { email: "NEW@example.com" }));
    const body = await response.json();

    expect(createInvitationMock).toHaveBeenCalledTimes(1);
    expect(setPendingHouseholdInviteSecretHashMock).toHaveBeenCalledTimes(1);
    expect(sendHouseholdInviteEmailMock).toHaveBeenCalledTimes(1);
    const inviteUrl = sendHouseholdInviteEmailMock.mock.calls[0]?.[0]?.inviteUrl;
    expect(typeof inviteUrl).toBe("string");
    const parsedInviteUrl = new URL(inviteUrl as string);
    expect(parsedInviteUrl.searchParams.get("invitationId")).toBe("12");
    expect(parsedInviteUrl.searchParams.get("secret")).toBeTruthy();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.id).toBe(12);
    expect(body.inviteEmailSent).toBe(true);
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
  });

  it("POST maps duplicate pending invite to 409", async () => {
    createInvitationMock.mockRejectedValue({
      body: {
        code: "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION",
        message: "User is already invited to this organization",
      },
    });
    listInvitationsMock.mockResolvedValue([
      {
        id: 12,
        email: "new@example.com",
        role: "member",
        status: "pending",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      },
    ]);

    const response = await POST(requestWithBody("POST", { email: "new@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.code).toBe(API_ERROR_CODE.USER_ALREADY_INVITED);
    expect(body.error).toBe(
      "Invite already pending for this email. Resend or revoke the existing invite.",
    );
    expect(body.existingInvite.id).toBe(12);
  });

  it("PATCH rejects attempts to change your own role", async () => {
    const response = await PATCH(requestWithBody("PATCH", { userId: 7, role: "member" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.SELF_ROLE_CHANGE_FORBIDDEN,
      error: "Users cannot change their own role",
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects non-integer member user ids", async () => {
    const response = await PATCH(requestWithBody("PATCH", { userId: 7.5, role: "member" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Member user id is required",
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  it("PATCH allows assigning owner role", async () => {
    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: {
        userId: 7,
      },
    });
    listMembersMock
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 9,
            role: "member",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 9,
            role: "owner",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            user: { name: "Taylor", email: "taylor@example.com" },
          },
        ],
      });
    updateMemberRoleMock.mockResolvedValue({
      id: 44,
      userId: 9,
      role: "owner",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: { name: "Taylor", email: "taylor@example.com" },
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "owner" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
    expect(updateMemberRoleMock).toHaveBeenCalledTimes(1);
    expect(updateMemberRoleMock.mock.calls[0]?.[0]?.body?.role).toBe("owner");
    expect(body.member.role).toBe("owner");
  });

  it("PATCH re-reads the updated member when the mutation response omits user details", async () => {
    listMembersMock
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 9,
            role: "member",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            user: { name: "Taylor", email: "taylor@example.com" },
          },
        ],
      })
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 9,
            role: "admin",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            user: { name: "Taylor", email: "taylor@example.com" },
          },
        ],
      });
    updateMemberRoleMock.mockResolvedValue({
      id: 44,
      userId: 9,
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "admin" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      member: {
        userId: 9,
        name: "Taylor",
        email: "taylor@example.com",
        role: "admin",
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("PATCH blocks admins from assigning owner role", async () => {
    listMembersMock.mockResolvedValue({
      members: [
        {
          id: 44,
          userId: 9,
          role: "member",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "owner" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  it("PATCH blocks admins from changing owner role", async () => {
    listMembersMock.mockResolvedValue({
      members: [
        {
          id: 44,
          userId: 9,
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "member" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  it("PATCH maps last-owner conflict to 409", async () => {
    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: {
        userId: 7,
      },
    });
    listMembersMock.mockResolvedValue({
      members: [
        {
          id: 44,
          userId: 9,
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    updateMemberRoleMock.mockRejectedValue({
      body: {
        code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
        message: "You cannot leave the organization as the only owner",
      },
    });

    const response = await PATCH(requestWithBody("PATCH", { userId: 9, role: "member" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.LAST_OWNER_REQUIRED,
      error: "At least one household owner must remain",
    });
  });

  it("GET preserves reconciliation headers on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
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
      getFullOrganizationMock.mockRejectedValue(new Error("snapshot failed"));

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

  it("DELETE blocks admins from removing an owner", async () => {
    listMembersMock.mockResolvedValue({
      members: [
        {
          id: 44,
          userId: 9,
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const response = await DELETE(requestWithBody("DELETE", { userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it("DELETE removes a member", async () => {
    listMembersMock.mockResolvedValue({
      members: [
        {
          id: 44,
          userId: 9,
          role: "member",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    removeMemberMock.mockResolvedValue({ ok: true });

    const response = await DELETE(requestWithBody("DELETE", { userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, removedUserId: 9 });
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
    expect(removeMemberMock).toHaveBeenCalledTimes(1);
  });

  it("DELETE rejects non-positive member user ids", async () => {
    const response = await DELETE(requestWithBody("DELETE", { userId: -9 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Member user id is required",
    });
    expect(removeMemberMock).not.toHaveBeenCalled();
  });
});
