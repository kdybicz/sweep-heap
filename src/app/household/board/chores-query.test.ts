import { describe, expect, it, vi } from "vitest";
import {
  fetchTodayChores,
  fetchWeekChores,
  getTodayChoresQueryKey,
  getWeekChoresQueryKey,
} from "@/app/household/board/chores-query";
import type { ChoreItem } from "@/app/household/board/types";
import { HouseholdContextRedirectError } from "@/app/household/household-context-client";

const createChore = (id: number, occurrenceStartDate: string): ChoreItem => ({
  id,
  title: `Chore ${id}`,
  type: "close_on_done",
  occurrence_date: occurrenceStartDate,
  occurrence_start_date: occurrenceStartDate,
  status: "open",
  closed_reason: null,
  notes: null,
});

const createResponse = (
  body: unknown,
  status = 200,
  contentType = "application/json",
): Pick<Response, "headers" | "json" | "status"> => ({
  headers: new Headers({ "content-type": contentType }),
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

  it("throws HouseholdContextRedirectError when household is missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        createResponse({ ok: false, error: "Household required", code: "HOUSEHOLD_REQUIRED" }, 403),
      );

    await expect(fetchWeekChores({ weekOffset: 0, fetchImpl })).rejects.toBeInstanceOf(
      HouseholdContextRedirectError,
    );
  });

  it("throws HouseholdContextRedirectError when household selection is required", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(
        {
          ok: false,
          error: "Active household selection required",
          code: "HOUSEHOLD_SELECTION_REQUIRED",
        },
        409,
      ),
    );

    await expect(fetchTodayChores({ todayKey: "2026-03-05", fetchImpl })).rejects.toMatchObject({
      redirectPath: "/household/select",
    });
  });

  it("throws fallback error when response is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createResponse({ ok: false }));

    await expect(fetchTodayChores({ todayKey: "2026-03-05", fetchImpl })).rejects.toThrow(
      "Failed to load today's chores",
    );
  });

  it("throws fallback error when response is not json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createResponse("<html></html>", 500, "text/html"));

    await expect(fetchWeekChores({ weekOffset: 0, fetchImpl })).rejects.toThrow(
      "Failed to load chores",
    );
  });
});
