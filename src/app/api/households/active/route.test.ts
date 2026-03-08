import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const { getSessionMock, getHouseholdSummaryForUserMock, setActiveOrganizationMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    getHouseholdSummaryForUserMock: vi.fn(),
    setActiveOrganizationMock: vi.fn(),
  }),
);

vi.mock("@/auth", () => ({
  auth: {
    api: {
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getHouseholdSummaryForUser: getHouseholdSummaryForUserMock,
}));

import { POST } from "@/app/api/households/active/route";

const requestWithBody = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/households/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/households/active route", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getHouseholdSummaryForUserMock.mockReset();
    setActiveOrganizationMock.mockReset();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("switches to a household the user belongs to", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });
    getHouseholdSummaryForUserMock.mockResolvedValue({
      id: 12,
      name: "Home",
      timeZone: "UTC",
      icon: "🏡",
      role: "admin",
    });

    const response = await POST(requestWithBody({ householdId: 12 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=updated");
    expect(body).toEqual({
      ok: true,
      householdId: 12,
      household: {
        id: 12,
        name: "Home",
        timeZone: "UTC",
        icon: "🏡",
        role: "admin",
      },
    });
    expect(getHouseholdSummaryForUserMock).toHaveBeenCalledWith({
      householdId: 12,
      userId: 4,
    });
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "12",
      },
      headers: expect.any(Headers),
    });
  });

  it("rejects invalid household ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });

    const response = await POST(requestWithBody({ householdId: "bad" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Household id is required",
    });
    expect(getHouseholdSummaryForUserMock).not.toHaveBeenCalled();
  });

  it("returns not found for inaccessible households", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "4" } });
    getHouseholdSummaryForUserMock.mockResolvedValue(null);

    const response = await POST(requestWithBody({ householdId: 12 }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
      error: "Household not found",
    });
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });
});
