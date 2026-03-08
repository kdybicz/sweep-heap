import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  setActiveOrganizationMock,
  getSessionMock,
  createHouseholdWithOwnerMock,
  resolveActiveHouseholdMock,
  updateHouseholdByIdMock,
} = vi.hoisted(() => ({
  setActiveOrganizationMock: vi.fn(),
  getSessionMock: vi.fn(),
  createHouseholdWithOwnerMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
  updateHouseholdByIdMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  createHouseholdWithOwner: createHouseholdWithOwnerMock,
  updateHouseholdById: updateHouseholdByIdMock,
}));

vi.mock("@/lib/services", () => ({
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

import { GET, PATCH, POST } from "@/app/api/households/route";

const requestWithBody = (method: "POST" | "PATCH", body: Record<string, unknown>) =>
  new Request("http://localhost/api/households", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const requestWithRawBody = (method: "POST" | "PATCH", rawBody: string) =>
  new Request("http://localhost/api/households", {
    method,
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });

describe("/api/households route", () => {
  beforeEach(() => {
    setActiveOrganizationMock.mockReset();
    getSessionMock.mockReset();
    createHouseholdWithOwnerMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
    updateHouseholdByIdMock.mockReset();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=abc; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("GET returns active household for authenticated user", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 11,
        name: "Home",
        timeZone: "Europe/Warsaw",
        icon: "🏡",
        role: "admin",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      household: {
        id: 11,
        name: "Home",
        timeZone: "Europe/Warsaw",
        icon: "🏡",
        role: "admin",
      },
    });
  });

  it("GET returns household required when user has no active household", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Household required",
      code: API_ERROR_CODE.HOUSEHOLD_REQUIRED,
    });
  });

  it("GET returns invalid user when session user id is not numeric", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "not-a-number" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
  });

  it("GET returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "7" } });
      resolveActiveHouseholdMock.mockRejectedValue(new Error("db failed"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to load household",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST normalizes icon and creates household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    createHouseholdWithOwnerMock.mockResolvedValue(100);

    const response = await POST(
      requestWithBody("POST", {
        name: "  The Heap  ",
        timeZone: "UTC",
        icon: "  🧹🧹🧹🧹🧹🧹🧹🧹🧹  ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, householdId: 100 });
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        name: "The Heap",
        timeZone: "UTC",
        icon: "🧹🧹🧹🧹🧹🧹🧹🧹",
      }),
    );
    expect(createHouseholdWithOwnerMock.mock.calls[0]?.[0]?.slug).toMatch(/^the-heap-/);
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "100",
      },
      headers: expect.any(Headers),
    });
  });

  it("POST still creates a household for users who already belong to another one", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    createHouseholdWithOwnerMock.mockResolvedValue(101);

    const response = await POST(
      requestWithBody("POST", {
        name: "Side Project",
        timeZone: "UTC",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, householdId: 101 });
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        name: "Side Project",
      }),
    );
  });

  it("POST fails when switching the active household fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "21" } });
      createHouseholdWithOwnerMock.mockResolvedValue(102);
      setActiveOrganizationMock.mockRejectedValue(new Error("session update failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
      expect(createHouseholdWithOwnerMock).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to set active household after create",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST rejects invalid time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(
      requestWithBody("POST", {
        name: "The Heap",
        timeZone: "Not/AZone",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST rejects non-object json payloads", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(requestWithRawBody("POST", "[]"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_JSON_BODY,
      error: "Invalid JSON body",
    });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "21" } });
      createHouseholdWithOwnerMock.mockRejectedValue(new Error("insert failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Heap",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to create household",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PATCH rejects non-admin users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "member",
      },
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "New Flat",
        timeZone: "UTC",
        icon: "🏠",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Forbidden",
    });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH updates household and clears empty icon", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: "🏠",
        role: "owner",
      },
    });
    updateHouseholdByIdMock.mockResolvedValue({
      id: 3,
      name: "Flat 2",
      timeZone: "UTC",
      icon: null,
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "  Flat 2  ",
        timeZone: "UTC",
        icon: "   ",
      }),
    );
    const body = await response.json();

    expect(updateHouseholdByIdMock).toHaveBeenCalledWith({
      householdId: 3,
      name: "Flat 2",
      timeZone: "UTC",
      icon: null,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      household: {
        id: 3,
        name: "Flat 2",
        timeZone: "UTC",
        icon: null,
      },
    });
  });

  it("PATCH rejects invalid time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: "🏠",
        role: "owner",
      },
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "Flat 2",
        timeZone: "invalid/zone",
        icon: "🏠",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("GET returns selection required when multiple households exist without an active choice", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.HOUSEHOLD_SELECTION_REQUIRED,
      error: "Active household selection required",
    });
  });
});
