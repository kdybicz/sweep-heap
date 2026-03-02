import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createDeleteAccountTokenMock, sendDeleteAccountConfirmationEmailMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    createDeleteAccountTokenMock: vi.fn(),
    sendDeleteAccountConfirmationEmailMock: vi.fn(),
  }));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/repositories", () => ({
  buildDeleteAccountTokenIdentifier: ({ nonce, userId }: { nonce: string; userId: number }) =>
    `delete-account:${userId}:${nonce}`,
  createDeleteAccountToken: createDeleteAccountTokenMock,
}));

vi.mock("@/lib/delete-account-email", () => ({
  sendDeleteAccountConfirmationEmail: sendDeleteAccountConfirmationEmailMock,
}));

import { POST } from "@/app/api/me/delete-request/route";

const request = () =>
  new Request("http://localhost/api/me/delete-request", {
    method: "POST",
  });

describe("/api/me/delete-request route", () => {
  beforeEach(() => {
    authMock.mockReset();
    createDeleteAccountTokenMock.mockReset();
    sendDeleteAccountConfirmationEmailMock.mockReset();
  });

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects non-numeric user ids", async () => {
    authMock.mockResolvedValue({ user: { id: "abc", email: "alex@example.com" } });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid user" });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects when account has no email", async () => {
    authMock.mockResolvedValue({ user: { id: "4", email: null } });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "Email is required to confirm account deletion",
    });
    expect(createDeleteAccountTokenMock).not.toHaveBeenCalled();
    expect(sendDeleteAccountConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("creates and emails delete confirmation token", async () => {
    authMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });

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

  it("returns server error when email delivery fails", async () => {
    authMock.mockResolvedValue({ user: { id: "4", email: "alex@example.com" } });
    sendDeleteAccountConfirmationEmailMock.mockRejectedValue(new Error("smtp down"));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Failed to send confirmation email" });
    expect(createDeleteAccountTokenMock).toHaveBeenCalledTimes(1);
  });
});
