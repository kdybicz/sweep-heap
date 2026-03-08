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
  getHouseholdTimeZoneById,
  getPendingHouseholdInviteByIdAndSecret,
  listOwnedHouseholdsWithOtherMembers,
  setPendingHouseholdInviteSecretHash,
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
