import { describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ pool: { query } }));

import { insertChore } from "@/lib/repositories/chore-repository";

const input = {
  householdId: 11,
  title: "Insert fixture",
  type: "close_on_done",
  startDate: "2026-01-05",
  endDate: "2026-01-06",
  seriesEndDate: null,
  repeatRule: "none",
  notes: null,
};
describe("chore insertion contract", () => {
  it("requires a returned id so suppressed inserts cannot commit source cancellation", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(insertChore(input)).rejects.toThrow("did not return an id");
  });
  it("returns the successfully inserted id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    expect(await insertChore(input)).toBe(42);
  });
});
