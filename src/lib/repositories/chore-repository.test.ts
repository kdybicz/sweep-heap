import { describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ pool: { query } }));

import {
  insertChore,
  listActiveChoreSeriesByHousehold,
  listChoreExceptionsByHousehold,
  listChoreOccurrenceExceptions,
  updateChoreSeries,
} from "@/lib/repositories/chore-repository";
import { listActiveChoreSeriesQuery } from "@/lib/repositories/chore-series-query";

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
  it("persists an inherited calendar day on insert and clears it on re-anchoring updates", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 43 }] });
    await insertChore({ ...input, recurrenceAnchorDay: 31 });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("recurrence_anchor_day"), [
      11,
      input.title,
      input.type,
      input.startDate,
      input.endDate,
      null,
      "none",
      null,
      31,
    ]);
    await updateChoreSeries({ ...input, choreId: 43, recurrenceAnchorDay: null });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("recurrence_anchor_day = $9"), [
      43,
      input.title,
      input.type,
      input.startDate,
      input.endDate,
      null,
      "none",
      null,
      null,
    ]);
  });
});

describe("chore series selection contract", () => {
  it("uses the integration-tested SQL with household and date-range bindings", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listActiveChoreSeriesByHousehold({
      householdId: 11,
      rangeStart: "2026-10-12",
      rangeEnd: "2026-10-18",
    });
    // The API discards non-overlapping series later, so its output alone cannot catch SQL overfetch.
    expect(query).toHaveBeenLastCalledWith(listActiveChoreSeriesQuery, [
      11,
      "2026-10-12",
      "2026-10-18",
    ]);
  });
  it("binds the overflow sentinel row limit without interpolating values into SQL", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listActiveChoreSeriesByHousehold({
      householdId: 11,
      rangeStart: "2026-10-12",
      rangeEnd: "2026-10-18",
      maxResults: 10001,
    });
    expect(query).toHaveBeenLastCalledWith(`${listActiveChoreSeriesQuery} limit $4`, [
      11,
      "2026-10-12",
      "2026-10-18",
      10001,
    ]);
    query.mockResolvedValueOnce({ rows: [] });
    await listChoreExceptionsByHousehold({
      householdId: 11,
      rangeStart: "2026-10-12",
      rangeEnd: "2026-10-18",
      maxResults: 10001,
    });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("limit $4"), [
      11,
      "2026-10-12",
      "2026-10-18",
      10001,
    ]);
    query.mockResolvedValueOnce({ rows: [] });
    await listChoreOccurrenceExceptions({ choreId: 42, fromDate: "2026-10-12", maxResults: 10001 });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("limit $3"), [
      42,
      "2026-10-12",
      10001,
    ]);
  });
});
