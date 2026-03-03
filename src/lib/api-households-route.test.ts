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

  it("POST normalizes icon and invalid timezone before create", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    getUserMembershipsMock.mockResolvedValue([]);
    createHouseholdWithOwnerMock.mockResolvedValue(100);

    const response = await POST(
      requestWithBody("POST", {
        name: "  The Heap  ",
        timeZone: "Not/AZone",
        icon: "  🧹🧹🧹🧹🧹🧹🧹🧹🧹  ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, householdId: 100 });
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith({
      userId: 21,
      name: "The Heap",
      timeZone: "UTC",
      icon: "🧹🧹🧹🧹🧹🧹🧹🧹",
    });
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
      role: "admin",
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
        timeZone: "invalid/zone",
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
});
