import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const {
  listMembersMock,
  requireApiHouseholdAdminMock,
  updateMemberRoleMock,
  withHouseholdMutationLockMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  requireApiHouseholdAdminMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      listMembers: listMembersMock,
      updateMemberRole: updateMemberRoleMock,
    },
  },
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHouseholdAdmin: requireApiHouseholdAdminMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import { POST } from "@/app/api/households/members/owner-transfer/route";

const requestWithBody = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/members/owner-transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/households/members/owner-transfer route", () => {
  beforeEach(() => {
    listMembersMock.mockReset();
    requireApiHouseholdAdminMock.mockReset();
    updateMemberRoleMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

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
  });

  it("transfers ownership and demotes the current owner to admin", async () => {
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
        user: { name: "Taylor", email: "taylor@example.com" },
      })
      .mockResolvedValueOnce({
        id: 44,
        userId: 7,
        role: "admin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Alex", email: "alex@example.com" },
      });

    const response = await POST(requestWithBody({ userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
    expect(updateMemberRoleMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ body: expect.objectContaining({ memberId: "45", role: "owner" }) }),
    );
    expect(updateMemberRoleMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ body: expect.objectContaining({ memberId: "44", role: "admin" }) }),
    );
    expect(body).toEqual({
      ok: true,
      transferredToUserId: 9,
      members: [
        {
          userId: 9,
          name: "Taylor",
          email: "taylor@example.com",
          role: "owner",
          joinedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          userId: 7,
          name: "Alex",
          email: "alex@example.com",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("re-reads members after transfer when role mutations return partial member data", async () => {
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
            role: "admin",
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

    const response = await POST(requestWithBody({ userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      transferredToUserId: 9,
      members: [
        {
          userId: 9,
          name: "Taylor",
          email: "taylor@example.com",
          role: "owner",
          joinedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          userId: 7,
          name: "Alex",
          email: "alex@example.com",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("blocks owners from transferring ownership to themselves", async () => {
    const response = await POST(requestWithBody({ userId: 7 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_TRANSFER_SELF_FORBIDDEN,
      error: "Owners cannot transfer ownership to themselves",
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  it("blocks admins from transferring ownership", async () => {
    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers(),
      household: { id: 11, name: "Home", role: "admin" },
      sessionContext: { userId: 7 },
    });

    const response = await POST(requestWithBody({ userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can transfer ownership",
    });
  });

  it("rolls back target promotion when actor demotion fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      listMembersMock.mockResolvedValue({
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
      });
      updateMemberRoleMock
        .mockResolvedValueOnce({
          id: 45,
          userId: 9,
          role: "owner",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          user: { name: "Taylor", email: "taylor@example.com" },
        })
        .mockRejectedValueOnce(new Error("demotion failed"))
        .mockResolvedValueOnce({
          id: 45,
          userId: 9,
          role: "member",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          user: { name: "Taylor", email: "taylor@example.com" },
        });

      const response = await POST(requestWithBody({ userId: 9 }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to transfer household ownership",
      });
      expect(updateMemberRoleMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          body: expect.objectContaining({ memberId: "45", role: "member" }),
        }),
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        "Failed to roll back ownership transfer",
        expect.anything(),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
