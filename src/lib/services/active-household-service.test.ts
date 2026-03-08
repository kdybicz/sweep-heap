import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getHouseholdSummaryForUserMock,
  listActiveHouseholdsForUserMock,
  setActiveOrganizationMock,
} = vi.hoisted(() => ({
  getHouseholdSummaryForUserMock: vi.fn(),
  listActiveHouseholdsForUserMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
}));

vi.mock("@/lib/repositories", () => ({
  getHouseholdSummaryForUser: getHouseholdSummaryForUserMock,
  listActiveHouseholdsForUser: listActiveHouseholdsForUserMock,
}));

import {
  reconcileActiveHouseholdSession,
  resolveActiveHousehold,
} from "@/lib/services/active-household-service";

describe("resolveActiveHousehold", () => {
  beforeEach(() => {
    getHouseholdSummaryForUserMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
    setActiveOrganizationMock.mockReset();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("uses the session active household when membership is valid", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue({
      id: 12,
      name: "Home",
      timeZone: "UTC",
      icon: "🏡",
      role: "admin",
    });

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: 12,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "resolved",
      household: {
        id: 12,
        name: "Home",
        timeZone: "UTC",
        icon: "🏡",
        role: "admin",
      },
      source: "session",
    });
    expect(listActiveHouseholdsForUserMock).not.toHaveBeenCalled();
  });

  it("falls back to the only active household when session context is unset", async () => {
    listActiveHouseholdsForUserMock.mockResolvedValue([
      {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
    ]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: null,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "resolved",
      household: {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
      source: "fallback",
    });
  });

  it("returns none when the user has no active households", async () => {
    listActiveHouseholdsForUserMock.mockResolvedValue([]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: null,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "none",
    });
  });

  it("requires explicit selection when multiple households are available", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue(null);
    listActiveHouseholdsForUserMock.mockResolvedValue([
      {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
      {
        id: 12,
        name: "Cabin",
        timeZone: "UTC",
        icon: "🏕",
        role: "member",
      },
    ]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: 7,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "selection-required",
      households: [
        {
          id: 9,
          name: "Flat",
          timeZone: "Europe/Warsaw",
          icon: null,
          role: "owner",
        },
        {
          id: 12,
          name: "Cabin",
          timeZone: "UTC",
          icon: "🏕",
          role: "member",
        },
      ],
    });
  });
});

describe("reconcileActiveHouseholdSession", () => {
  beforeEach(() => {
    setActiveOrganizationMock.mockClear();
  });

  it("activates the sole fallback household in session", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 9,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      },
      sessionActiveHouseholdId: null,
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "9",
      },
      headers: expect.any(Headers),
    });
    expect(headers.get("set-cookie")).toContain("better-auth.session=updated");
  });

  it("clears stale session selection when no household remains", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "none",
      },
      sessionActiveHouseholdId: 9,
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: null,
      },
      headers: expect.any(Headers),
    });
    expect(headers.get("set-cookie")).toContain("better-auth.session=updated");
  });

  it("does not mutate session when selection is already valid", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "resolved",
        source: "session",
        household: {
          id: 9,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      },
      sessionActiveHouseholdId: 9,
    });

    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    expect(headers.get("set-cookie")).toBeNull();
  });
});
