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
      .mockResolvedValueOnce({
        rows: [{ householdId: 2 }, { householdId: 5 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({ userId: 9 });

    expect(result).toEqual({
      id: 9,
      deletedHouseholdIds: [2],
    });
    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(client.query.mock.calls[1]?.[0]).toBe(
      "select distinct household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active'",
    );
    expect(client.query.mock.calls[1]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[2]?.[0]).toBe("delete from users where id = $1 returning id");
    expect(client.query.mock.calls[2]?.[1]).toEqual([9]);
    expect(client.query.mock.calls[3]?.[0]).toBe(
      "delete from households where id = any($1::int[]) and not exists (select 1 from household_memberships where household_memberships.household_id = households.id and household_memberships.status = 'active') returning id",
    );
    expect(client.query.mock.calls[3]?.[1]).toEqual([[2, 5]]);
    expect(client.query.mock.calls[4]?.[0]).toBe("commit");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("returns null and rolls back when user does not exist", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ householdId: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    const result = await deleteUserById({ userId: 55 });

    expect(result).toBeNull();
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
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
    client.query.mockResolvedValueOnce({}).mockRejectedValueOnce(error).mockResolvedValueOnce({});

    await expect(deleteUserById({ userId: 12 })).rejects.toThrow("delete failed");

    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
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
      "delete from verification_token where identifier like $1",
      ["delete-account:9:%"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      "insert into verification_token (identifier, token, expires) values ($1, $2, $3)",
      ["delete-account:9:nonce", "hash", expiresAt],
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
      "delete from verification_token where identifier = $1 and token = $2 and expires > now() returning identifier",
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
