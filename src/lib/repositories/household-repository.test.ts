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
  getPendingHouseholdInviteByIdAndSecret,
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
