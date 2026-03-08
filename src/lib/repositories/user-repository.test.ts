import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock, queryMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    connect: connectMock,
    query: queryMock,
  },
}));

import {
  buildDeleteAccountTokenIdentifier,
  consumeDeleteAccountToken,
  createDeleteAccountToken,
  deleteUserById,
  extractUserIdFromDeleteAccountTokenIdentifier,
  updateUserNameById,
} from "@/lib/repositories";

describe("updateUserNameById", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("updates a user with a trimmed name", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 9,
          name: "Alex",
          email: "alex@example.com",
        },
      ],
    });

    const user = await updateUserNameById({
      userId: 9,
      name: "  Alex  ",
    });

    expect(queryMock).toHaveBeenCalledWith(
      "update users set name = $1 where id = $2 returning id, name, email",
      ["Alex", 9],
    );
    expect(user).toEqual({
      id: 9,
      name: "Alex",
      email: "alex@example.com",
    });
  });

  it("returns null when no user row is returned", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const user = await updateUserNameById({
      userId: 44,
      name: "Robin",
    });

    expect(user).toBeNull();
  });
});

describe("deleteUserById", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("deletes user and prunes now-empty households", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ householdId: 2 }, { householdId: 5 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({ userId: 9 });

    expect(result).toEqual({
      ok: true,
      id: 9,
      deletedHouseholdIds: [2],
    });
    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(client.query.mock.calls[1]?.[0]).toBe(
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
    );
    expect(client.query.mock.calls[1]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[2]?.[0]).toBe("select pg_advisory_xact_lock($1)");
    expect(client.query.mock.calls[2]?.[1]).toEqual([2]);
    expect(client.query.mock.calls[3]?.[0]).toBe(
      "select h.id as \"householdId\", h.name as \"householdName\", count(other_members.user_id)::int as \"otherActiveMemberCount\" from household_memberships owner_membership join households h on h.id = owner_membership.household_id left join household_memberships other_members on other_members.household_id = h.id and other_members.status = 'active' and other_members.user_id <> $1 where owner_membership.user_id = $1 and owner_membership.status = 'active' and owner_membership.role = 'owner' group by h.id, h.name having count(other_members.user_id) > 0 order by h.id asc",
    );
    expect(client.query.mock.calls[3]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[4]?.[0]).toBe(
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active'",
    );
    expect(client.query.mock.calls[4]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[5]?.[0]).toBe("delete from users where id = $1 returning id");
    expect(client.query.mock.calls[5]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[6]?.[0]).toBe(
      "delete from households where id = any($1::int[]) and not exists (select 1 from household_memberships where household_memberships.household_id = households.id and household_memberships.status = 'active') returning id",
    );
    expect(client.query.mock.calls[6]?.[1]).toEqual([[2, 5]]);
    expect(client.query.mock.calls[7]?.[0]).toBe("commit");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("returns ownership conflict when owned households still have other active members", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            householdId: 2,
            householdName: "Home",
            otherActiveMemberCount: 1,
          },
        ],
      })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({ userId: 9 });

    expect(result).toEqual({
      ok: false,
      reason: "ownership-conflict",
      blockingHouseholds: [
        {
          householdId: 2,
          householdName: "Home",
          otherActiveMemberCount: 1,
        },
      ],
    });
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
      "select pg_advisory_xact_lock($1)",
      "select h.id as \"householdId\", h.name as \"householdName\", count(other_members.user_id)::int as \"otherActiveMemberCount\" from household_memberships owner_membership join households h on h.id = owner_membership.household_id left join household_memberships other_members on other_members.household_id = h.id and other_members.status = 'active' and other_members.user_id <> $1 where owner_membership.user_id = $1 and owner_membership.status = 'active' and owner_membership.role = 'owner' group by h.id, h.name having count(other_members.user_id) > 0 order by h.id asc",
      "rollback",
    ]);
  });

  it("returns invalid-token when token cannot be consumed inside delete transaction", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({
      deleteAccountToken: {
        identifier: "delete-account:9:nonce",
        tokenHash: "hash",
      },
      userId: 9,
    });

    expect(result).toEqual({ ok: false, reason: "invalid-token" });
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "delete from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now() returning identifier",
      "rollback",
    ]);
  });

  it("consumes token inside delete transaction when provided", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ identifier: "delete-account:9:nonce" }] })
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({
      deleteAccountToken: {
        identifier: "delete-account:9:nonce",
        tokenHash: "hash",
      },
      userId: 9,
    });

    expect(result).toEqual({
      ok: true,
      id: 9,
      deletedHouseholdIds: [2],
    });
    expect(client.query.mock.calls[1]).toEqual([
      "delete from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now() returning identifier",
      ["delete-account:9:nonce", "hash"],
    ]);
    expect(client.query.mock.calls[2]).toEqual([
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
      [9],
    ]);
    expect(client.query.mock.calls[3]).toEqual(["select pg_advisory_xact_lock($1)", [2]]);
  });

  it("returns null and rolls back when user does not exist", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({ userId: 55 });

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
      "select h.id as \"householdId\", h.name as \"householdName\", count(other_members.user_id)::int as \"otherActiveMemberCount\" from household_memberships owner_membership join households h on h.id = owner_membership.household_id left join household_memberships other_members on other_members.household_id = h.id and other_members.status = 'active' and other_members.user_id <> $1 where owner_membership.user_id = $1 and owner_membership.status = 'active' and owner_membership.role = 'owner' group by h.id, h.name having count(other_members.user_id) > 0 order by h.id asc",
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active'",
      "delete from users where id = $1 returning id",
      "rollback",
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and rethrows when delete fails", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    const error = new Error("delete failed");
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({});

    await expect(deleteUserById({ userId: 12 })).rejects.toThrow("delete failed");

    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' and role = 'owner' order by household_id asc",
      "select h.id as \"householdId\", h.name as \"householdName\", count(other_members.user_id)::int as \"otherActiveMemberCount\" from household_memberships owner_membership join households h on h.id = owner_membership.household_id left join household_memberships other_members on other_members.household_id = h.id and other_members.status = 'active' and other_members.user_id <> $1 where owner_membership.user_id = $1 and owner_membership.status = 'active' and owner_membership.role = 'owner' group by h.id, h.name having count(other_members.user_id) > 0 order by h.id asc",
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active'",
      "rollback",
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe("delete account token helpers", () => {
  it("builds identifier with user id and nonce", () => {
    const identifier = buildDeleteAccountTokenIdentifier({
      userId: 7,
      nonce: "abc123",
    });

    expect(identifier).toBe("delete-account:7:abc123");
  });

  it("extracts user id from valid identifier", () => {
    const userId = extractUserIdFromDeleteAccountTokenIdentifier("delete-account:42:nonce_123");
    expect(userId).toBe(42);
  });

  it("returns null for invalid identifier", () => {
    const userId = extractUserIdFromDeleteAccountTokenIdentifier("bad-identifier");
    expect(userId).toBeNull();
  });
});

describe("createDeleteAccountToken", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("replaces previous tokens for the user and inserts a new one", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    const expiresAt = new Date("2026-03-02T12:00:00.000Z");

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await createDeleteAccountToken({
      userId: 9,
      identifier: "delete-account:9:nonce",
      tokenHash: "hash",
      expiresAt,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "begin");
    expect(client.query).toHaveBeenNthCalledWith(2, "select pg_advisory_xact_lock($1)", [9]);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "delete from delete_account_tokens where user_id = $1",
      [9],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      "insert into delete_account_tokens (user_id, identifier, token_hash, expires_at) values ($1, $2, $3, $4)",
      [9, "delete-account:9:nonce", "hash", expiresAt],
    );
    expect(client.query).toHaveBeenNthCalledWith(5, "commit");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe("consumeDeleteAccountToken", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns identifier when token is consumed", async () => {
    queryMock.mockResolvedValue({ rows: [{ identifier: "delete-account:4:nonce" }] });

    const identifier = await consumeDeleteAccountToken({
      identifier: "delete-account:4:nonce",
      tokenHash: "hash",
    });

    expect(queryMock).toHaveBeenCalledWith(
      "delete from delete_account_tokens where identifier = $1 and token_hash = $2 and expires_at > now() returning identifier",
      ["delete-account:4:nonce", "hash"],
    );
    expect(identifier).toBe("delete-account:4:nonce");
  });

  it("returns null when token is missing or expired", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const identifier = await consumeDeleteAccountToken({
      identifier: "delete-account:4:nonce",
      tokenHash: "hash",
    });

    expect(identifier).toBeNull();
  });
});
