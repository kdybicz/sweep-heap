import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const originalAuthUrl = process.env.AUTH_URL;

const {
  getSessionMock,
  createDeleteAccountTokenMock,
  listAccountDeletionBlockingHouseholdsMock,
  sendDeleteAccountConfirmationEmailMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createDeleteAccountTokenMock: vi.fn(),
  listAccountDeletionBlockingHouseholdsMock: vi.fn(),
  sendDeleteAccountConfirmationEmailMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  buildDeleteAccountTokenIdentifier: ({ nonce, userId }: { nonce: string; userId: number }) =>
    `delete-account:${userId}:${nonce}`,
  createDeleteAccountToken: createDeleteAccountTokenMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  listAccountDeletionBlockingHouseholds: listAccountDeletionBlockingHouseholdsMock,
}));

vi.mock("@/lib/delete-account-email", () => ({
  sendDeleteAccountConfirmationEmail: sendDeleteAccountConfirmationEmailMock,
}));

import { POST } from "@/app/api/me/delete-request/route";

const request = (url = "http://localhost/api/me/delete-request") =>
  new Request(url, {
    method: "POST",
  });

describe("/api/me/delete-request route", () => {
  beforeEach(() => {
    process.env.AUTH_URL = "http://localhost";
    getSessionMock.mockReset();
    createDeleteAccountTokenMock.mockReset();
    listAccountDeletionBlockingHouseholdsMock.mockReset();
    sendDeleteAccountConfirmationEmailMock.mockReset();

    listAccountDeletionBlockingHouseholdsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = originalAuthUrl;
    }
  });

  it("rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.UNAUTHORIZED,
      error: "Unauthorized",
    });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("blocks delete requests when owned households still have other active members", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });
    listAccountDeletionBlockingHouseholdsMock.mockResolvedValue([
      {
        householdId: 12,
        householdName: "Home",
        otherActiveMemberCount: 2,
      },
    ]);

    const response = await POST(request());
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
          otherActiveMemberCount: 2,
        },
      ],
    });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects non-numeric user ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "abc", email: "alex@example.com" } });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects when account has no email", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4", email: null } });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.EMAIL_REQUIRED,
      error: "Email is required to confirm account deletion",
    });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("creates and emails delete confirmation token", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(createDeleteAccountTokenMock).toHaveBeenCalledTimes(1);
    const createTokenArgs = createDeleteAccountTokenMock.mock.calls[0]?.[0];
    expect(createTokenArgs.userId).toBe(4);
    expect(createTokenArgs.identifier).toMatch(/^delete-account:4:[A-Za-z0-9_-]+$/);
    expect(createTokenArgs.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createTokenArgs.expiresAt).toBeInstanceOf(Date);

    expect(sendDeleteAccountConfirmationEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendDeleteAccountConfirmationEmailMock.mock.calls[0]?.[0];
    expect(emailArgs.to).toBe("alex@example.com");
    expect(emailArgs.expiresInMinutes).toBe(30);
    const confirmationUrl = new URL(emailArgs.confirmationUrl);
    expect(confirmationUrl.origin).toBe("http://localhost");
    expect(confirmationUrl.pathname).toBe("/user/delete/confirm");
    expect(confirmationUrl.searchParams.get("identifier")).toBe(createTokenArgs.identifier);
    expect(confirmationUrl.searchParams.get("token")).toBeTruthy();
  });

  it("falls back to request origin when AUTH_URL is missing", async () => {
    delete process.env.AUTH_URL;
    getSessionMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });

    const response = await POST(request("https://preview.example.com/api/me/delete-request"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(sendDeleteAccountConfirmationEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendDeleteAccountConfirmationEmailMock.mock.calls[0]?.[0];
    const confirmationUrl = new URL(emailArgs.confirmationUrl);
    expect(confirmationUrl.origin).toBe("https://preview.example.com");
  });

  it("returns server error when email delivery fails", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });
    sendDeleteAccountConfirmationEmailMock.mockRejectedValue(new Error("smtp down"));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to send confirmation email",
    });
    expect(createDeleteAccountTokenMock).toHaveBeenCalledTimes(1);
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });
      createDeleteAccountTokenMock.mockRejectedValue(new Error("db failed"));

      const response = await POST(request());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to create delete account request",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
