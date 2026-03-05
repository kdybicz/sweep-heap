import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    connect: connectMock,
    query: vi.fn(),
  },
}));

import { createHouseholdMemberInvite } from "@/lib/repositories/household-repository";

describe("createHouseholdMemberInvite", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("retries invite insert after duplicate conflict with expired pending rows", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    const duplicateInviteError = Object.assign(new Error("duplicate invite"), {
      code: "23505",
      constraint: "household_member_invites_pending_email_unique",
    });
    const createdInvite = {
      id: 91,
      householdId: 7,
      householdName: "Home",
      email: "alex@example.com",
      role: "member" as const,
      invitedByUserId: 11,
      createdAt: new Date("2026-03-05T18:00:00.000Z"),
      expiresAt: new Date("2026-03-12T18:00:00.000Z"),
    };

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(duplicateInviteError)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [createdInvite] })
      .mockResolvedValueOnce({});

    const result = await createHouseholdMemberInvite({
      email: "alex@example.com",
      expiresAt: new Date("2026-03-12T18:00:00.000Z"),
      householdId: 7,
      identifier: "household-invite-7-token",
      invitedByUserId: 11,
      role: "member",
      tokenHash: "hashed-token",
    });

    expect(result).toEqual({
      status: "invited",
      invite: createdInvite,
    });

    const calls = client.query.mock.calls.map((call) => call[0]);
    const insertCalls = calls.filter(
      (query) =>
        typeof query === "string" && query.startsWith("insert into household_member_invites"),
    );
    expect(insertCalls).toHaveLength(2);
    expect(calls).toContain("savepoint pending_invite_insert");
    expect(calls).toContain("rollback to savepoint pending_invite_insert");
    expect(calls).toContain("commit");
    expect(calls).not.toContain("rollback");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("returns already_invited when a concurrent pending invite is found after duplicate conflict", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    const duplicateInviteError = Object.assign(new Error("duplicate invite"), {
      code: "23505",
      constraint: "household_member_invites_pending_email_unique",
    });
    const existingInvite = {
      id: 18,
      householdId: 7,
      householdName: "Home",
      email: "alex@example.com",
      role: "member" as const,
      invitedByUserId: 3,
      createdAt: new Date("2026-03-05T18:01:00.000Z"),
      expiresAt: new Date("2026-03-12T18:01:00.000Z"),
    };

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(duplicateInviteError)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [existingInvite] })
      .mockResolvedValueOnce({});

    const result = await createHouseholdMemberInvite({
      email: "alex@example.com",
      expiresAt: new Date("2026-03-12T18:00:00.000Z"),
      householdId: 7,
      identifier: "household-invite-7-token",
      invitedByUserId: 11,
      role: "member",
      tokenHash: "hashed-token",
    });

    expect(result).toEqual({
      status: "already_invited",
      invite: existingInvite,
    });

    const calls = client.query.mock.calls.map((call) => call[0]);
    const insertCalls = calls.filter(
      (query) =>
        typeof query === "string" && query.startsWith("insert into household_member_invites"),
    );
    expect(insertCalls).toHaveLength(1);
    expect(calls).toContain("savepoint pending_invite_insert");
    expect(calls).toContain("rollback to savepoint pending_invite_insert");
    expect(calls).toContain("commit");
    expect(calls).not.toContain("rollback");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
