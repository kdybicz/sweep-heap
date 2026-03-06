import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  createHouseholdWithOwnerMock,
  getActiveHouseholdSummaryMock,
  getUserMembershipsMock,
  updateHouseholdByIdMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createHouseholdWithOwnerMock: vi.fn(),
  getActiveHouseholdSummaryMock: vi.fn(),
  getUserMembershipsMock: vi.fn(),
  updateHouseholdByIdMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  createHouseholdWithOwner: createHouseholdWithOwnerMock,
  getActiveHouseholdSummary: getActiveHouseholdSummaryMock,
  getUserMemberships: getUserMembershipsMock,
  updateHouseholdById: updateHouseholdByIdMock,
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
    getSessionMock.mockReset();
    createHouseholdWithOwnerMock.mockReset();
    getActiveHouseholdSummaryMock.mockReset();
    getUserMembershipsMock.mockReset();
    updateHouseholdByIdMock.mockReset();
  });

  it("GET returns active household for authenticated user", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 11,
      name: "Home",
      timeZone: "Europe/Warsaw",
      icon: "🏡",
      role: "admin",
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
    getSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveHouseholdSummaryMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Household required",
      code: "HOUSEHOLD_REQUIRED",
    });
  });

  it("GET returns invalid user when session user id is not numeric", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "not-a-number" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid user" });
    expect(getActiveHouseholdSummaryMock).not.toHaveBeenCalled();
  });

  it("GET returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "7" } });
      getActiveHouseholdSummaryMock.mockRejectedValue(new Error("db failed"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to load household" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST normalizes icon and creates household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    getUserMembershipsMock.mockResolvedValue([]);
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
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        name: "The Heap",
        timeZone: "UTC",
        icon: "🧹🧹🧹🧹🧹🧹🧹🧹",
      }),
    );
    expect(createHouseholdWithOwnerMock.mock.calls[0]?.[0]?.slug).toMatch(/^the-heap-/);
  });

  it("POST rejects invalid time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    getUserMembershipsMock.mockResolvedValue([]);

    const response = await POST(
      requestWithBody("POST", {
        name: "The Heap",
        timeZone: "Not/AZone",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid time zone" });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST rejects non-object json payloads", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(requestWithRawBody("POST", "[]"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid JSON body" });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "21" } });
      getUserMembershipsMock.mockResolvedValue([]);
      createHouseholdWithOwnerMock.mockRejectedValue(new Error("insert failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Heap",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "Failed to create household" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PATCH rejects non-admin users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 3,
      name: "Flat",
      timeZone: "UTC",
      icon: null,
      role: "member",
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
    expect(body).toEqual({ ok: false, error: "Forbidden" });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH updates household and clears empty icon", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 3,
      name: "Flat",
      timeZone: "UTC",
      icon: "🏠",
      role: "owner",
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
    getSessionMock.mockResolvedValue({ user: { id: "9" } });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 3,
      name: "Flat",
      timeZone: "UTC",
      icon: "🏠",
      role: "owner",
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
    expect(body).toEqual({ ok: false, error: "Invalid time zone" });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });
});
