import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  getSessionMock,
  getUserMembershipsMock,
  reconcileActiveHouseholdSessionMock,
  resolveActiveHouseholdMock,
  updateUserNameByIdMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getUserMembershipsMock: vi.fn(),
  reconcileActiveHouseholdSessionMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
  updateUserNameByIdMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getUserMemberships: getUserMembershipsMock,
  updateUserNameById: updateUserNameByIdMock,
}));

vi.mock("@/lib/services", () => ({
  reconcileActiveHouseholdSession: reconcileActiveHouseholdSessionMock,
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

import { GET, PATCH } from "@/app/api/me/route";

const patchRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const invalidJsonPatchRequest = () =>
  new Request("http://localhost/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

describe("/api/me route", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getUserMembershipsMock.mockReset();
    reconcileActiveHouseholdSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
    updateUserNameByIdMock.mockReset();

    reconcileActiveHouseholdSessionMock.mockResolvedValue(new Headers());
  });

  it("GET rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.UNAUTHORIZED,
      error: "Unauthorized",
    });
    expect(getUserMembershipsMock).not.toHaveBeenCalled();
    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
  });

  it("GET rejects non-numeric user ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "abc" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
    expect(getUserMembershipsMock).not.toHaveBeenCalled();
    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
  });

  it("GET returns user details and memberships", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: "4",
        name: "Alex",
        email: "alex@example.com",
      },
      session: {
        activeOrganizationId: "12",
      },
    });
    getUserMembershipsMock.mockResolvedValue([
      {
        householdId: 12,
        role: "admin",
        status: "active",
      },
    ]);
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 12,
        name: "Home",
        role: "admin",
        icon: null,
        timeZone: "UTC",
      },
    });
    reconcileActiveHouseholdSessionMock.mockResolvedValue(
      new Headers({ "set-cookie": "better-auth.session=healed; Path=/; HttpOnly" }),
    );

    const response = await GET(new Request("http://localhost/api/me"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: "4",
        email: "alex@example.com",
        name: "Alex",
      },
      memberships: [
        {
          householdId: 12,
          role: "admin",
          status: "active",
        },
      ],
      activeHouseholdId: 12,
    });
    expect(getUserMembershipsMock).toHaveBeenCalledWith(4);
    expect(resolveActiveHouseholdMock).toHaveBeenCalledWith({
      sessionActiveHouseholdId: 12,
      userId: 4,
    });
    expect(reconcileActiveHouseholdSessionMock).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      resolution: {
        status: "resolved",
        source: "session",
        household: {
          id: 12,
          name: "Home",
          role: "admin",
          icon: null,
          timeZone: "UTC",
        },
      },
      sessionActiveHouseholdId: 12,
    });
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
  });

  it("GET returns null active household when user must select one", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: "4",
        name: "Alex",
        email: "alex@example.com",
      },
      session: {
        activeOrganizationId: null,
      },
    });
    getUserMembershipsMock.mockResolvedValue([
      {
        householdId: 12,
        role: "admin",
        status: "active",
      },
      {
        householdId: 14,
        role: "member",
        status: "active",
      },
    ]);
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activeHouseholdId).toBeNull();
  });

  it("GET preserves reconciliation cookies when session healing returns non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: {
          id: "4",
          name: "Alex",
          email: "alex@example.com",
        },
        session: {
          activeOrganizationId: "12",
        },
      });
      getUserMembershipsMock.mockResolvedValue([]);
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 12,
          name: "Home",
          role: "admin",
          icon: null,
          timeZone: "UTC",
        },
      });
      const reconciliationError = new Error("set active failed") as Error & {
        responseHeaders?: Headers;
      };
      reconciliationError.responseHeaders = new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      });
      reconcileActiveHouseholdSessionMock.mockRejectedValueOnce(reconciliationError);

      const response = await GET(new Request("http://localhost/api/me"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household session",
        reconciliationError,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("GET returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: {
          id: "4",
          name: "Alex",
          email: "alex@example.com",
        },
      });
      getUserMembershipsMock.mockRejectedValue(new Error("db failed"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to load user",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PATCH rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Alex" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.UNAUTHORIZED,
      error: "Unauthorized",
    });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects non-numeric user ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "abc" } });

    const response = await PATCH(patchRequest({ name: "Alex" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects invalid json payloads", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });

    const response = await PATCH(invalidJsonPatchRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_JSON_BODY,
      error: "Invalid JSON body",
    });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects empty names", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });

    const response = await PATCH(patchRequest({ name: "   " }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.NAME_REQUIRED,
      error: "Name is required",
    });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH returns not found when user does not exist", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });
    updateUserNameByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Alex" }));
    const body = await response.json();

    expect(updateUserNameByIdMock).toHaveBeenCalledWith({
      userId: 4,
      name: "Alex",
    });
    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.USER_NOT_FOUND,
      error: "User not found",
    });
  });

  it("PATCH updates user name", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });
    updateUserNameByIdMock.mockResolvedValue({
      id: 4,
      name: "Alex",
      email: "alex@example.com",
    });

    const response = await PATCH(patchRequest({ name: "  Alex  " }));
    const body = await response.json();

    expect(updateUserNameByIdMock).toHaveBeenCalledWith({
      userId: 4,
      name: "Alex",
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: 4,
        name: "Alex",
        email: "alex@example.com",
      },
    });
  });

  it("PATCH returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "4", name: "Alex", email: "alex@example.com" },
        session: { activeOrganizationId: "12" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "fallback",
        household: {
          id: 12,
          name: "Home",
          role: "admin",
          icon: null,
          timeZone: "UTC",
        },
      });
      reconcileActiveHouseholdSessionMock.mockResolvedValue(
        new Headers({ "set-cookie": "better-auth.session=healed; Path=/; HttpOnly" }),
      );
      updateUserNameByIdMock.mockRejectedValue(new Error("db failed"));

      const response = await PATCH(patchRequest({ name: "Alex" }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to update user",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
