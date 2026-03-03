import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, getActiveHouseholdIdMock, getUserMembershipsMock, updateUserNameByIdMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    getActiveHouseholdIdMock: vi.fn(),
    getUserMembershipsMock: vi.fn(),
    updateUserNameByIdMock: vi.fn(),
  }));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getActiveHouseholdId: getActiveHouseholdIdMock,
  getUserMemberships: getUserMembershipsMock,
  updateUserNameById: updateUserNameByIdMock,
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
    getActiveHouseholdIdMock.mockReset();
    getUserMembershipsMock.mockReset();
    updateUserNameByIdMock.mockReset();
  });

  it("GET rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
    expect(getUserMembershipsMock).not.toHaveBeenCalled();
    expect(getActiveHouseholdIdMock).not.toHaveBeenCalled();
  });

  it("GET rejects non-numeric user ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "abc" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid user" });
    expect(getUserMembershipsMock).not.toHaveBeenCalled();
    expect(getActiveHouseholdIdMock).not.toHaveBeenCalled();
  });

  it("GET returns user details and memberships", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: "4",
        name: "Alex",
        email: "alex@example.com",
      },
    });
    getUserMembershipsMock.mockResolvedValue([
      {
        householdId: 12,
        role: "admin",
        status: "active",
      },
    ]);
    getActiveHouseholdIdMock.mockResolvedValue(12);

    const response = await GET();
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
    expect(getActiveHouseholdIdMock).toHaveBeenCalledWith(4);
  });

  it("PATCH rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Alex" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects non-numeric user ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "abc" } });

    const response = await PATCH(patchRequest({ name: "Alex" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid user" });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects invalid json payloads", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });

    const response = await PATCH(invalidJsonPatchRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Invalid JSON body" });
    expect(updateUserNameByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects empty names", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });

    const response = await PATCH(patchRequest({ name: "   " }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Name is required" });
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
    expect(body).toEqual({ ok: false, error: "User not found" });
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
});
