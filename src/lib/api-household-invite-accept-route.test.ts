import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acceptHouseholdInviteMock,
  createVerificationValueMock,
  getSessionMock,
  getValidHouseholdInviteMock,
} = vi.hoisted(() => ({
  acceptHouseholdInviteMock: vi.fn(),
  createVerificationValueMock: vi.fn(),
  getSessionMock: vi.fn(),
  getValidHouseholdInviteMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: {
        createVerificationValue: createVerificationValueMock,
      },
    }),
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  acceptHouseholdInvite: acceptHouseholdInviteMock,
  getValidHouseholdInvite: getValidHouseholdInviteMock,
}));

import { POST } from "@/app/api/households/invites/accept/route";

const requestWithBody = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/invites/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/households/invites/accept route", () => {
  beforeEach(() => {
    acceptHouseholdInviteMock.mockReset();
    createVerificationValueMock.mockReset();
    getSessionMock.mockReset();
    getValidHouseholdInviteMock.mockReset();
  });

  it("rejects missing identifier or token", async () => {
    const response = await POST(requestWithBody({ identifier: "id" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Identifier and token are required" });
    expect(getValidHouseholdInviteMock).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired invites", async () => {
    getValidHouseholdInviteMock.mockResolvedValue(null);

    const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid or expired invite" });
    expect(acceptHouseholdInviteMock).not.toHaveBeenCalled();
    expect(createVerificationValueMock).not.toHaveBeenCalled();
  });

  it("accepts invite immediately for signed-in invited user", async () => {
    getValidHouseholdInviteMock.mockResolvedValue({
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({
      status: "accepted",
      householdId: 11,
      householdName: "Home",
      wasAlreadyMember: false,
    });

    const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
    const body = await response.json();

    expect(acceptHouseholdInviteMock).toHaveBeenCalledTimes(1);
    const acceptArgs = acceptHouseholdInviteMock.mock.calls[0]?.[0];
    expect(acceptArgs).toMatchObject({
      email: "jane@example.com",
      identifier: "id",
      userId: 5,
    });
    expect(acceptArgs.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createVerificationValueMock).not.toHaveBeenCalled();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      redirectUrl: "/household",
      householdId: 11,
      householdName: "Home",
      wasAlreadyMember: false,
    });
  });

  it("returns conflict when signed-in user belongs to another household", async () => {
    getValidHouseholdInviteMock.mockResolvedValue({
      householdId: 11,
      householdName: "Home",
      email: "jane@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "jane@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({ status: "belongs_to_other_household" });

    const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ ok: false, error: "You already belong to another household" });
  });

  it("starts auto sign-in flow when no session exists", async () => {
    getValidHouseholdInviteMock.mockResolvedValue({
      householdId: 11,
      householdName: "Home",
      email: "invited@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue(null);

    const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
    const body = await response.json();

    expect(acceptHouseholdInviteMock).not.toHaveBeenCalled();
    expect(createVerificationValueMock).toHaveBeenCalledTimes(1);

    const createArgs = createVerificationValueMock.mock.calls[0]?.[0];
    expect(createArgs.identifier).toEqual(expect.any(String));
    expect(createArgs.expiresAt).toBeInstanceOf(Date);
    expect(JSON.parse(createArgs.value)).toEqual({ email: "invited@example.com", name: "" });

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.redirectUrl).toBe("string");
    const redirectUrl = new URL(body.redirectUrl);
    expect(redirectUrl.pathname).toBe("/api/auth/magic-link/verify");
    expect(redirectUrl.searchParams.get("token")).toBe(createArgs.identifier);
    expect(redirectUrl.searchParams.get("callbackURL")).toBe(
      "/api/households/invites/complete?identifier=id&token=token",
    );
  });

  it("starts auto sign-in flow when session email does not match invite", async () => {
    getValidHouseholdInviteMock.mockResolvedValue({
      householdId: 11,
      householdName: "Home",
      email: "invited@example.com",
      role: "member",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    getSessionMock.mockResolvedValue({ user: { id: "5", email: "other@example.com" } });
    acceptHouseholdInviteMock.mockResolvedValue({
      status: "email_mismatch",
      inviteEmail: "invited@example.com",
    });

    const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
    const body = await response.json();

    expect(acceptHouseholdInviteMock).toHaveBeenCalledTimes(1);
    expect(createVerificationValueMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.redirectUrl).toBe("string");
  });

  it("returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getValidHouseholdInviteMock.mockRejectedValue(new Error("db failed"));

      const response = await POST(requestWithBody({ identifier: "id", token: "token" }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to accept household invite" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
