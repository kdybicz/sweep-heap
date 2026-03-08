import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHouseholdSummaryForUserMock, listActiveHouseholdsForUserMock } = vi.hoisted(() => ({
  getHouseholdSummaryForUserMock: vi.fn(),
  listActiveHouseholdsForUserMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  getHouseholdSummaryForUser: getHouseholdSummaryForUserMock,
  listActiveHouseholdsForUser: listActiveHouseholdsForUserMock,
}));

import { resolveActiveHousehold } from "@/lib/services/active-household-service";

describe("resolveActiveHousehold", () => {
  beforeEach(() => {
    getHouseholdSummaryForUserMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
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
