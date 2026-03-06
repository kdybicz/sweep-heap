import { describe, expect, it, vi } from "vitest";
import {
  fetchTodayChores,
  fetchWeekChores,
  getTodayChoresQueryKey,
  getWeekChoresQueryKey,
  HouseholdRequiredError,
} from "@/app/household/board/chores-query";
import type { ChoreItem } from "@/app/household/board/types";

const createChore = (id: number, occurrenceDate: string): ChoreItem => ({
  id,
  title: `Chore ${id}`,
  type: "close_on_done",
  occurrence_date: occurrenceDate,
  status: "open",
  closed_reason: null,
  undo_until: null,
  can_undo: false,
  notes: null,
});

const createResponse = (body: unknown, status = 200): Pick<Response, "json" | "status"> => ({
  json: vi.fn().mockResolvedValue(body),
  status,
});

describe("chores-query helpers", () => {
  it("returns stable week query keys", () => {
    expect(getWeekChoresQueryKey(3)).toEqual(["household-chores", "week", 3]);
  });

  it("returns stable today query keys", () => {
    expect(getTodayChoresQueryKey("2026-03-05")).toEqual([
      "household-chores",
      "today",
      "2026-03-05",
    ]);
  });

  it("fetchWeekChores returns normalized data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse({
        ok: true,
        chores: [createChore(1, "2026-03-03")],
        timeZone: "UTC",
        rangeStart: "2026-03-03",
        rangeEnd: "2026-03-09",
      }),
    );

    const data = await fetchWeekChores({
      weekOffset: 1,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/chores?weekOffset=1", {
      cache: "no-store",
      signal: undefined,
    });
    expect(data).toEqual({
      chores: [createChore(1, "2026-03-03")],
      timeZone: "UTC",
      rangeStart: "2026-03-03",
      rangeEnd: "2026-03-09",
    });
  });

  it("fetchTodayChores returns normalized data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse({
        ok: true,
        chores: [createChore(2, "2026-03-05")],
        timeZone: "America/New_York",
      }),
    );

    const data = await fetchTodayChores({
      todayKey: "2026-03-05",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/chores?start=2026-03-05&end=2026-03-05", {
      cache: "no-store",
      signal: undefined,
    });
    expect(data).toEqual({
      chores: [createChore(2, "2026-03-05")],
      timeZone: "America/New_York",
      rangeStart: null,
      rangeEnd: null,
    });
  });

  it("throws HouseholdRequiredError when household is missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        createResponse({ ok: false, error: "Household required", code: "HOUSEHOLD_REQUIRED" }, 403),
      );

    await expect(fetchWeekChores({ weekOffset: 0, fetchImpl })).rejects.toBeInstanceOf(
      HouseholdRequiredError,
    );
  });

  it("throws fallback error when response is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createResponse({ ok: false }));

    await expect(fetchTodayChores({ todayKey: "2026-03-05", fetchImpl })).rejects.toThrow(
      "Failed to load today's chores",
    );
  });
});
