import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    query: queryMock,
    connect: vi.fn(),
  },
}));

import {
  countActiveHouseholdMembersExcludingUser,
  getHouseholdSummaryForUser,
  getHouseholdTimeZoneById,
  getPendingHouseholdInviteByIdAndSecret,
  listActiveHouseholdsForUser,
  listOwnedHouseholdsWithOtherMembers,
  setPendingHouseholdInviteSecretHash,
  updateHouseholdById,
} from "@/lib/repositories/household-repository";

describe("getPendingHouseholdInviteByIdAndSecret", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns invite when id and secret hash match", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 12,
          householdId: 11,
          householdName: "Home",
          email: "pending@example.com",
          role: "member",
          invitedByUserId: 7,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          expiresAt: new Date("2126-01-08T00:00:00.000Z"),
        },
      ],
    });

    const invite = await getPendingHouseholdInviteByIdAndSecret({
      inviteId: 12,
      secretHash: "secret-hash",
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[1]).toEqual([12, "secret-hash"]);
    expect(invite?.id).toBe(12);
  });

  it("returns null when id and secret hash do not match", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const invite = await getPendingHouseholdInviteByIdAndSecret({
      inviteId: 12,
      secretHash: "secret-hash",
    });

    expect(invite).toBeNull();
  });
});

describe("setPendingHouseholdInviteSecretHash", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("stores secret hash for pending invite", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 12 }] });

    const inviteId = await setPendingHouseholdInviteSecretHash({
      inviteId: 12,
      secretHash: "secret-hash",
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["secret-hash", 12]);
    expect(inviteId).toBe(12);
  });

  it("returns null when invite cannot be updated", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const inviteId = await setPendingHouseholdInviteSecretHash({
      inviteId: 12,
      secretHash: "secret-hash",
    });

    expect(inviteId).toBeNull();
  });
});

describe("getHouseholdTimeZoneById", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns a stored household time zone", async () => {
    queryMock.mockResolvedValue({ rows: [{ time_zone: "Europe/Warsaw" }] });

    await expect(getHouseholdTimeZoneById(7)).resolves.toBe("Europe/Warsaw");
  });

  it("throws when household time zone is missing", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(getHouseholdTimeZoneById(7)).rejects.toThrow("Household 7 not found");
  });
});

describe("listActiveHouseholdsForUser", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("maps household metadata into member chore permissions", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 7,
          name: "Home",
          timeZone: "UTC",
          icon: "🏡",
          role: "member",
          metadata: JSON.stringify({ membersCanManageChores: false }),
        },
        {
          id: 8,
          name: "Cabin",
          timeZone: "Europe/Warsaw",
          icon: null,
          role: "admin",
          metadata: null,
        },
      ],
    });

    await expect(listActiveHouseholdsForUser(9)).resolves.toEqual([
      {
        id: 7,
        name: "Home",
        timeZone: "UTC",
        icon: "🏡",
        role: "member",
        membersCanManageChores: false,
      },
      {
        id: 8,
        name: "Cabin",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "admin",
        membersCanManageChores: true,
      },
    ]);
  });
});

describe("getHouseholdSummaryForUser", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("defaults member chore permissions to true when metadata is invalid", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 7,
          name: "Home",
          timeZone: "UTC",
          icon: "🏡",
          role: "member",
          metadata: "not-json",
        },
      ],
    });

    await expect(getHouseholdSummaryForUser({ householdId: 7, userId: 9 })).resolves.toEqual({
      id: 7,
      name: "Home",
      timeZone: "UTC",
      icon: "🏡",
      role: "member",
      membersCanManageChores: true,
    });
  });
});

describe("updateHouseholdById", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("stores the member chore permission in metadata", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ metadata: JSON.stringify({ theme: "sunrise" }) }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            name: "Home",
            timeZone: "UTC",
            icon: null,
            metadata: JSON.stringify({ theme: "sunrise", membersCanManageChores: false }),
          },
        ],
      });

    await expect(
      updateHouseholdById({
        householdId: 7,
        name: "Home",
        timeZone: "UTC",
        icon: null,
        membersCanManageChores: false,
      }),
    ).resolves.toEqual({
      id: 7,
      name: "Home",
      timeZone: "UTC",
      icon: null,
      membersCanManageChores: false,
    });

    expect(queryMock.mock.calls[1]?.[1]).toEqual([
      "Home",
      "UTC",
      null,
      JSON.stringify({ theme: "sunrise", membersCanManageChores: false }),
      7,
    ]);
  });

  it("returns null when the household does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateHouseholdById({
        householdId: 7,
        name: "Home",
        timeZone: "UTC",
        icon: null,
        membersCanManageChores: true,
      }),
    ).resolves.toBeNull();

    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("countActiveHouseholdMembersExcludingUser", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("counts other active members in the household", async () => {
    queryMock.mockResolvedValue({ rows: [{ count: "2" }] });

    await expect(
      countActiveHouseholdMembersExcludingUser({
        excludedUserId: 7,
        householdId: 11,
      }),
    ).resolves.toBe(2);
  });
});

describe("listOwnedHouseholdsWithOtherMembers", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns owned households that still have other active members", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          householdId: 11,
          householdName: "Home",
          otherActiveMemberCount: 2,
        },
      ],
    });

    await expect(listOwnedHouseholdsWithOtherMembers(7)).resolves.toEqual([
      {
        householdId: 11,
        householdName: "Home",
        otherActiveMemberCount: 2,
      },
    ]);
  });
});
