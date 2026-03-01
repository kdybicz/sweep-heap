import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    connect: connectMock,
  },
}));

import { createHouseholdWithOwner } from "@/lib/households";

describe("createHouseholdWithOwner", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("creates household and owner in a transaction", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const householdId = await createHouseholdWithOwner({
      userId: 9,
      name: "  Home  ",
      timeZone: "UTC",
    });

    expect(householdId).toBe(42);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(client.query.mock.calls[1]?.[0]).toBe(
      "insert into households (name, time_zone) values ($1, $2) returning id",
    );
    expect(client.query.mock.calls[1]?.[1]).toEqual(["Home", "UTC"]);
    expect(client.query.mock.calls[2]?.[0]).toBe(
      "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
    );
    expect(client.query.mock.calls[2]?.[1]).toEqual([42, 9, "admin"]);
    expect(client.query.mock.calls[3]?.[0]).toBe("commit");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back when membership insert fails", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as unknown as PoolClient);

    const error = new Error("insert failed");

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({});

    await expect(
      createHouseholdWithOwner({ userId: 3, name: "Home", timeZone: "UTC" }),
    ).rejects.toThrow("insert failed");

    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      "begin",
      "insert into households (name, time_zone) values ($1, $2) returning id",
      "insert into household_memberships (household_id, user_id, role) values ($1, $2, $3)",
      "rollback",
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
