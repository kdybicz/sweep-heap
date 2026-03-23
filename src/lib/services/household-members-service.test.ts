import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const {
  cancelInvitationMock,
  createInvitationMock,
  listInvitationsMock,
  listMembersMock,
  removeMemberMock,
  sendHouseholdInviteMock,
  updateMemberRoleMock,
  withHouseholdMutationLockMock,
} = vi.hoisted(() => ({
  cancelInvitationMock: vi.fn(),
  createInvitationMock: vi.fn(),
  listInvitationsMock: vi.fn(),
  listMembersMock: vi.fn(),
  removeMemberMock: vi.fn(),
  sendHouseholdInviteMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      cancelInvitation: cancelInvitationMock,
      createInvitation: createInvitationMock,
      listInvitations: listInvitationsMock,
      listMembers: listMembersMock,
      removeMember: removeMemberMock,
      updateMemberRole: updateMemberRoleMock,
    },
  },
}));

vi.mock("@/lib/services/household-invite-service", () => ({
  sendHouseholdInvite: sendHouseholdInviteMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import {
  createHouseholdMemberInvite,
  removeHouseholdMember,
  resendHouseholdInvite,
  revokeHouseholdInvite,
  transferHouseholdOwnership,
  updateHouseholdMemberRole,
} from "@/lib/services/household-members-service";

const pendingInvite = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 12,
  email: "pending@example.com",
  role: "member",
  status: "pending",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2126-01-09T00:00:00.000Z"),
  ...overrides,
});

describe("household-members-service", () => {
  beforeEach(() => {
    cancelInvitationMock.mockReset();
    createInvitationMock.mockReset();
    listInvitationsMock.mockReset();
    listMembersMock.mockReset();
    removeMemberMock.mockReset();
    sendHouseholdInviteMock.mockReset();
    updateMemberRoleMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

    sendHouseholdInviteMock.mockResolvedValue({ inviteId: 12, inviteEmailSent: true });
  });

  it("creates a household invite and sends email", async () => {
    createInvitationMock.mockResolvedValue(pendingInvite({ email: "new@example.com" }));

    const result = await createHouseholdMemberInvite({
      email: "new@example.com",
      householdId: 11,
      householdName: "Home",
      inviterName: "Alex",
      request: new Request("http://localhost/api/households/members", { method: "POST" }),
    });

    expect(result).toEqual({
      ok: true,
      data: {
        invite: {
          id: 12,
          email: "new@example.com",
          role: "member",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          expiresAt: new Date("2126-01-09T00:00:00.000Z"),
        },
        inviteEmailSent: true,
      },
    });
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
  });

  it("maps duplicate pending invites with the existing invite payload", async () => {
    createInvitationMock.mockRejectedValue({
      body: {
        code: "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION",
      },
    });
    listInvitationsMock.mockResolvedValue([pendingInvite({ email: "new@example.com" })]);

    const result = await createHouseholdMemberInvite({
      email: "new@example.com",
      householdId: 11,
      householdName: "Home",
      inviterName: "Alex",
      request: new Request("http://localhost/api/households/members", { method: "POST" }),
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_INVITED,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      existingInvite: {
        id: 12,
        email: "new@example.com",
        role: "member",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2126-01-09T00:00:00.000Z"),
      },
    });
  });

  it("rejects self role changes", async () => {
    const result = await updateHouseholdMemberRole({
      actorRole: "admin",
      actorUserId: 7,
      householdId: 11,
      nextRole: "member",
      requestHeaders: new Headers(),
      targetUserId: 7,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: API_ERROR_CODE.SELF_ROLE_CHANGE_FORBIDDEN,
      error: "Users cannot change their own role",
    });
  });

  it("refreshes member data after a role update", async () => {
    listMembersMock
      .mockResolvedValueOnce({
        members: [
          { id: 44, userId: 9, role: "member", createdAt: new Date("2026-01-01T00:00:00.000Z") },
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

    const result = await updateHouseholdMemberRole({
      actorRole: "admin",
      actorUserId: 7,
      householdId: 11,
      nextRole: "admin",
      requestHeaders: new Headers(),
      targetUserId: 9,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        member: {
          userId: 9,
          name: "Taylor",
          email: "taylor@example.com",
          role: "admin",
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    });
  });

  it("blocks admins from removing owner members", async () => {
    listMembersMock.mockResolvedValue({
      members: [
        { id: 44, userId: 9, role: "owner", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      ],
    });

    const result = await removeHouseholdMember({
      actorRole: "admin",
      actorUserId: 7,
      householdId: 11,
      requestHeaders: new Headers(),
      targetUserId: 9,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it("preserves owner role when resending an owner invite", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite({ role: "owner" })]);
    createInvitationMock.mockResolvedValue(pendingInvite({ role: "owner" }));

    const result = await resendHouseholdInvite({
      actorRole: "owner",
      householdId: 11,
      householdName: "Home",
      inviteId: 12,
      inviterName: "Alex",
      request: new Request("http://localhost/api/households/members/invites/12", {
        method: "POST",
      }),
    });

    expect(result.ok).toBe(true);
    expect(createInvitationMock.mock.calls[0]?.[0]?.body?.role).toBe("owner");
  });

  it("blocks non-owners from resending owner invites", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite({ role: "owner" })]);

    const result = await resendHouseholdInvite({
      actorRole: "admin",
      householdId: 11,
      householdName: "Home",
      inviteId: 12,
      inviterName: "Alex",
      request: new Request("http://localhost/api/households/members/invites/12", {
        method: "POST",
      }),
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  });

  it("revokes a pending invite", async () => {
    listInvitationsMock.mockResolvedValue([pendingInvite()]);
    cancelInvitationMock.mockResolvedValue({});

    const result = await revokeHouseholdInvite({
      actorRole: "admin",
      householdId: 11,
      inviteId: 12,
      requestHeaders: new Headers(),
    });

    expect(result).toEqual({
      ok: true,
      data: { revokedInviteId: 12 },
    });
  });

  it("transfers ownership and returns refreshed members", async () => {
    listMembersMock
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 7,
            role: "owner",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            user: { name: "Alex", email: "alex@example.com" },
          },
          {
            id: 45,
            userId: 9,
            role: "member",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
            user: { name: "Taylor", email: "taylor@example.com" },
          },
        ],
      })
      .mockResolvedValueOnce({
        members: [
          {
            id: 44,
            userId: 7,
            role: "admin",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            user: { name: "Alex", email: "alex@example.com" },
          },
          {
            id: 45,
            userId: 9,
            role: "owner",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
            user: { name: "Taylor", email: "taylor@example.com" },
          },
        ],
      });
    updateMemberRoleMock
      .mockResolvedValueOnce({
        id: 45,
        userId: 9,
        role: "owner",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: 44,
        userId: 7,
        role: "admin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

    const result = await transferHouseholdOwnership({
      actorRole: "owner",
      actorUserId: 7,
      householdId: 11,
      requestHeaders: new Headers(),
      targetUserId: 9,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        transferredToUserId: 9,
        members: [
          {
            userId: 9,
            name: "Taylor",
            email: "taylor@example.com",
            role: "owner",
            joinedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
          {
            userId: 7,
            name: "Alex",
            email: "alex@example.com",
            role: "admin",
            joinedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      },
    });
  });
});
