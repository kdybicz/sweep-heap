import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { runMutationTransaction, transactionAwarePool } from "@/lib/mutation-transaction";

const fixture = () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const raw = { connect: vi.fn(), query: vi.fn() };
  const client = { query, release: vi.fn() } as unknown as PoolClient;
  return { query, raw, client, pool: transactionAwarePool(raw as unknown as Pool) };
};

describe("guarded mutation transaction routing", () => {
  it("routes repository queries and SDK connection leases to the same transaction", async () => {
    const { pool, client, raw, query } = fixture();
    await runMutationTransaction(
      client,
      async () => {
        await pool.query("repository write");
        const sdk = await pool.connect();
        try {
          await sdk.query("begin");
          await sdk.query("SDK write");
          await sdk.query("commit");
        } finally {
          sdk.release();
        }
      },
      () => undefined,
    );
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "repository write",
      "savepoint household_nested_1",
      "SDK write",
      "release savepoint household_nested_1",
    ]);
    expect(raw.connect).not.toHaveBeenCalled();
    expect(raw.query).not.toHaveBeenCalled();
    expect(client.release).not.toHaveBeenCalled();
  });

  it("fences subsequent writes after connection loss during a callback", async () => {
    const { pool, client, query } = fixture();
    let failure: Error | undefined;
    await expect(
      runMutationTransaction(
        client,
        async () => {
          await pool.query("first write");
          failure = new Error("lock lost");
          await pool.query("must not write");
        },
        () => failure,
      ),
    ).rejects.toThrow("lock lost");
    expect(query.mock.calls.map((call) => call[0])).toEqual(["first write"]);
  });

  it("rejects work scheduled after the callback lifetime", async () => {
    const { pool, client, query } = fixture();
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let late!: Promise<unknown>;
    await runMutationTransaction(
      client,
      async () => {
        late = gate.then(() => pool.query("late write"));
      },
      () => undefined,
    );
    resume();
    await expect(late).rejects.toThrow("transaction is closed");
    expect(query).not.toHaveBeenCalled();
  });

  it("serializes nested SDK transaction leases so savepoints cannot overlap", async () => {
    const { pool, client, query } = fixture();
    await runMutationTransaction(
      client,
      async () => {
        await Promise.all(
          ["A", "B"].map(async (name) => {
            const sdk = await pool.connect();
            try {
              await sdk.query("begin");
              await sdk.query(name);
              await sdk.query("commit");
            } finally {
              sdk.release();
            }
          }),
        );
      },
      () => undefined,
    );
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "savepoint household_nested_1",
      "A",
      "release savepoint household_nested_1",
      "savepoint household_nested_2",
      "B",
      "release savepoint household_nested_2",
    ]);
  });
});
