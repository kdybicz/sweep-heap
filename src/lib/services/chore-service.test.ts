import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteChoreOccurrenceOverrideMock,
  insertChoreMock,
  isChoreInHouseholdMock,
  listActiveChoreSeriesByHouseholdMock,
  listChoreOverridesByHouseholdMock,
  upsertChoreOccurrenceOverrideMock,
  getHouseholdTimeZoneByIdMock,
  normalizeRepeatRuleMock,
  validateChoreCreateMock,
  toISODateOrThrowMock,
} = vi.hoisted(() => ({
  deleteChoreOccurrenceOverrideMock: vi.fn(),
  insertChoreMock: vi.fn(),
  isChoreInHouseholdMock: vi.fn(),
  listActiveChoreSeriesByHouseholdMock: vi.fn(),
  listChoreOverridesByHouseholdMock: vi.fn(),
  upsertChoreOccurrenceOverrideMock: vi.fn(),
  getHouseholdTimeZoneByIdMock: vi.fn(),
  normalizeRepeatRuleMock: vi.fn(),
  validateChoreCreateMock: vi.fn(),
  toISODateOrThrowMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  deleteChoreOccurrenceOverride: deleteChoreOccurrenceOverrideMock,
  insertChore: insertChoreMock,
  isChoreInHousehold: isChoreInHouseholdMock,
  listActiveChoreSeriesByHousehold: listActiveChoreSeriesByHouseholdMock,
  listChoreOverridesByHousehold: listChoreOverridesByHouseholdMock,
  upsertChoreOccurrenceOverride: upsertChoreOccurrenceOverrideMock,
  getHouseholdTimeZoneById: getHouseholdTimeZoneByIdMock,
}));

vi.mock("@/lib/chore-validation", () => ({
  normalizeRepeatRule: normalizeRepeatRuleMock,
  validateChoreCreate: validateChoreCreateMock,
}));

vi.mock("@/lib/date", () => ({
  toISODateOrThrow: toISODateOrThrowMock,
}));

import { mutateChore } from "@/lib/services";

describe("mutateChore", () => {
  beforeEach(() => {
    deleteChoreOccurrenceOverrideMock.mockReset();
    insertChoreMock.mockReset();
    isChoreInHouseholdMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreOverridesByHouseholdMock.mockReset();
    upsertChoreOccurrenceOverrideMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    validateChoreCreateMock.mockReturnValue({});
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
    toISODateOrThrowMock.mockReturnValue("2026-01-01");
  });

  it("returns validation errors for create action", async () => {
    validateChoreCreateMock.mockReturnValue({ title: "Title is required" });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "create",
        title: "",
        startDate: "2026-01-02",
        endDate: "2026-01-03",
        repeatRule: "none",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "Validation failed",
        fieldErrors: { title: "Title is required" },
      },
    });
    expect(insertChoreMock).not.toHaveBeenCalled();
  });

  it("creates chore when create action is valid", async () => {
    insertChoreMock.mockResolvedValue(91);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "create",
        title: "Kitchen",
        startDate: "2026-01-02",
        endDate: "2026-01-03",
        repeatRule: "week",
        notes: "Wipe counters",
      },
    });

    expect(result.ok).toBe(true);
    expect(insertChoreMock).toHaveBeenCalledTimes(1);
    expect(insertChoreMock).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 11,
        title: "Kitchen",
        repeatRule: "week",
      }),
    );
  });

  it("rejects updates without chore id or occurrence date", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "Missing choreId or occurrenceDate",
      },
    });
  });

  it("returns 404 when chore does not belong to household", async () => {
    isChoreInHouseholdMock.mockResolvedValue(false);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      body: {
        ok: false,
        error: "Chore not found",
      },
    });
  });

  it("deletes override on undo action", async () => {
    isChoreInHouseholdMock.mockResolvedValue(true);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "undo",
        choreId: 3,
        occurrenceDate: "2026-01-03",
      },
    });

    expect(result.ok).toBe(true);
    expect(deleteChoreOccurrenceOverrideMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceDate: "2026-01-03",
    });
    expect(upsertChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });
});
