import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const { deleteUserByIdMock } = vi.hoisted(() => ({
  deleteUserByIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  deleteUserById: deleteUserByIdMock,
  extractUserIdFromDeleteAccountTokenIdentifier: (identifier: string) => {
    const match = /^delete-account:(\d+):[A-Za-z0-9_-]+$/.exec(identifier);
    if (!match) {
      return null;
    }

    return Number(match[1]);
  },
}));

import { POST } from "@/app/api/me/delete-confirm/route";

const confirmRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/me/delete-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const invalidJsonRequest = () =>
  new Request("http://localhost/api/me/delete-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

describe("/api/me/delete-confirm route", () => {
  beforeEach(() => {
    deleteUserByIdMock.mockReset();
  });

  it("rejects invalid json payloads", async () => {
    const response = await POST(invalidJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_JSON_BODY,
      error: "Invalid JSON body",
    });
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("requires identifier and token", async () => {
    const response = await POST(confirmRequest({ identifier: "", token: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Identifier and token are required",
    });
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects invalid token identifiers", async () => {
    const response = await POST(confirmRequest({ identifier: "bad", token: "token" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TOKEN_IDENTIFIER,
      error: "Invalid token identifier",
    });
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired tokens", async () => {
    deleteUserByIdMock.mockResolvedValue({ ok: false, reason: "invalid-token" });

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.DELETE_TOKEN_INVALID,
      error: "Invalid or expired token",
    });
    expect(deleteUserByIdMock).toHaveBeenCalledWith({
      deleteAccountToken: {
        identifier: "delete-account:4:nonce",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      userId: 4,
    });
  });

  it("blocks deletion when owned households still have other active members", async () => {
    deleteUserByIdMock.mockResolvedValue({
      ok: false,
      reason: "ownership-conflict",
      blockingHouseholds: [
        {
          householdId: 12,
          householdName: "Home",
          otherActiveMemberCount: 1,
        },
      ],
    });

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.ACCOUNT_DELETE_REQUIRES_SOLO_OWNERSHIP,
      error: "Remove other active members from owned households before deleting your account",
      blockingHouseholds: [
        {
          householdId: 12,
          householdName: "Home",
          otherActiveMemberCount: 1,
        },
      ],
    });
  });

  it("returns not found when user cannot be deleted", async () => {
    deleteUserByIdMock.mockResolvedValue({ ok: false, reason: "not-found" });

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.USER_NOT_FOUND,
      error: "User not found",
    });
    expect(deleteUserByIdMock).toHaveBeenCalledWith({
      deleteAccountToken: {
        identifier: "delete-account:4:nonce",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      userId: 4,
    });
  });

  it("deletes account after valid token confirmation", async () => {
    deleteUserByIdMock.mockResolvedValue({
      ok: true,
      id: 4,
      deletedHouseholdIds: [2],
    });

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedUserId: 4,
      deletedHouseholdIds: [2],
    });
    expect(deleteUserByIdMock).toHaveBeenCalledWith({
      deleteAccountToken: {
        identifier: "delete-account:4:nonce",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      userId: 4,
    });
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      deleteUserByIdMock.mockRejectedValue(new Error("db failed"));

      const response = await POST(
        confirmRequest({
          identifier: "delete-account:4:nonce",
          token: "raw-token",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to confirm account deletion",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
