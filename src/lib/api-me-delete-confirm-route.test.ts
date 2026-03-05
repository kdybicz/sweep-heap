import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeDeleteAccountTokenMock, deleteUserByIdMock } = vi.hoisted(() => ({
  consumeDeleteAccountTokenMock: vi.fn(),
  deleteUserByIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  consumeDeleteAccountToken: consumeDeleteAccountTokenMock,
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
    consumeDeleteAccountTokenMock.mockReset();
    deleteUserByIdMock.mockReset();
  });

  it("rejects invalid json payloads", async () => {
    const response = await POST(invalidJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid JSON body" });
    expect(consumeDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("requires identifier and token", async () => {
    const response = await POST(confirmRequest({ identifier: "", token: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Identifier and token are required" });
    expect(consumeDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects invalid token identifiers", async () => {
    const response = await POST(confirmRequest({ identifier: "bad", token: "token" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid token identifier" });
    expect(consumeDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired tokens", async () => {
    consumeDeleteAccountTokenMock.mockResolvedValue(null);

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid or expired token" });
    expect(consumeDeleteAccountTokenMock).toHaveBeenCalledWith({
      identifier: "delete-account:4:nonce",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(deleteUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns not found when user cannot be deleted", async () => {
    consumeDeleteAccountTokenMock.mockResolvedValue("delete-account:4:nonce");
    deleteUserByIdMock.mockResolvedValue(null);

    const response = await POST(
      confirmRequest({
        identifier: "delete-account:4:nonce",
        token: "raw-token",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "User not found" });
    expect(deleteUserByIdMock).toHaveBeenCalledWith({ userId: 4 });
  });

  it("deletes account after valid token confirmation", async () => {
    consumeDeleteAccountTokenMock.mockResolvedValue("delete-account:4:nonce");
    deleteUserByIdMock.mockResolvedValue({
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
    expect(deleteUserByIdMock).toHaveBeenCalledWith({ userId: 4 });
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      consumeDeleteAccountTokenMock.mockRejectedValue(new Error("db failed"));

      const response = await POST(
        confirmRequest({
          identifier: "delete-account:4:nonce",
          token: "raw-token",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to confirm account deletion" });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(deleteUserByIdMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
