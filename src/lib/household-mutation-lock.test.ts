import { beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdMutationBusyError } from "@/lib/household-mutation-error";

const { connect, query, release, on, removeListener } = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ householdLockPool: { connect } }));

import { withHouseholdMutationLock } from "@/lib/household-mutation-lock";

describe("household mutation lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    connect.mockResolvedValue({ query, release, on, removeListener });
  });

  it("holds a transaction lock until the callback finishes", async () => {
    const result = await withHouseholdMutationLock({
      householdId: 42,
      task: async () => {
        expect(query.mock.calls.map((call) => call[0])).toEqual([
          "begin",
          "set local lock_timeout = '5s'",
          "select pg_advisory_xact_lock($1)",
        ]);
        expect(release).not.toHaveBeenCalled();
        return "done";
      },
    });
    expect(result).toBe("done");
    expect(query).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("does not run a callback after lock timeout and returns a retryable error", async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: "55P03" });
    const task = vi.fn();
    await expect(withHouseholdMutationLock({ householdId: 42, task })).rejects.toBeInstanceOf(
      HouseholdMutationBusyError,
    );
    expect(task).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith("rollback");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rolls back on callback errors and preserves their identity", async () => {
    const failure = new Error("mutation failed");
    await expect(
      withHouseholdMutationLock({
        householdId: 42,
        task: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(query).toHaveBeenLastCalledWith("rollback");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("destroys a connection when rollback fails rather than leaking a pooled lock", async () => {
    const failure = new Error("mutation failed");
    const rollback = new Error("connection lost");
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(rollback);
    await expect(
      withHouseholdMutationLock({
        householdId: 42,
        task: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(release).toHaveBeenCalledWith(rollback);
  });

  it("does not run mutations after the checked-out lock connection fails", async () => {
    const failure = new Error("lock connection lost");
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockImplementationOnce(async () => {
        on.mock.calls[0][1](failure);
        return {};
      });
    const task = vi.fn();
    await expect(withHouseholdMutationLock({ householdId: 42, task })).rejects.toBe(failure);
    expect(task).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(failure);
  });
});
