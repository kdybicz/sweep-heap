import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const { requireApiHouseholdAdminMock, transferHouseholdOwnershipMock } = vi.hoisted(() => ({
  requireApiHouseholdAdminMock: vi.fn(),
  transferHouseholdOwnershipMock: vi.fn(),
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHouseholdAdmin: requireApiHouseholdAdminMock,
}));

vi.mock("@/lib/services", () => ({
  transferHouseholdOwnership: transferHouseholdOwnershipMock,
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
    requireApiHouseholdAdminMock.mockReset();
    transferHouseholdOwnershipMock.mockReset();

    requireApiHouseholdAdminMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: { userId: 7 },
    });
  });

  it("delegates ownership transfer to the service", async () => {
    transferHouseholdOwnershipMock.mockResolvedValue({
      ok: true,
      data: {
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
      },
    });

    const response = await POST(requestWithBody({ userId: 9 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transferredToUserId).toBe(9);
    expect(transferHouseholdOwnershipMock).toHaveBeenCalledWith({
      actorRole: "owner",
      actorUserId: 7,
      householdId: 11,
      requestHeaders: expect.any(Headers),
      targetUserId: 9,
    });
  });

  it("returns service failures", async () => {
    transferHouseholdOwnershipMock.mockResolvedValue({
      ok: false,
      status: 400,
      code: API_ERROR_CODE.OWNER_TRANSFER_SELF_FORBIDDEN,
      error: "Owners cannot transfer ownership to themselves",
    });

    const response = await POST(requestWithBody({ userId: 7 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.OWNER_TRANSFER_SELF_FORBIDDEN,
      error: "Owners cannot transfer ownership to themselves",
    });
  });

  it("rejects invalid payloads before calling the service", async () => {
    const response = await POST(requestWithBody({ userId: 7.5 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Member user id is required",
    });
    expect(transferHouseholdOwnershipMock).not.toHaveBeenCalled();
  });

  it("preserves reconciliation headers on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      transferHouseholdOwnershipMock.mockRejectedValue(new Error("transfer failed"));

      const response = await POST(requestWithBody({ userId: 9 }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to transfer household ownership",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
