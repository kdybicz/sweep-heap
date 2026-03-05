import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteChoreOccurrenceOverrideMock,
  getChoreInHouseholdMock,
  getChoreOccurrenceOverrideMock,
  insertChoreMock,
  listActiveChoreSeriesByHouseholdMock,
  listChoreOverridesByHouseholdMock,
  upsertChoreOccurrenceOverrideMock,
  getHouseholdTimeZoneByIdMock,
  normalizeRepeatRuleMock,
  validateChoreCreateMock,
  toISODateOrThrowMock,
} = vi.hoisted(() => ({
  deleteChoreOccurrenceOverrideMock: vi.fn(),
  getChoreInHouseholdMock: vi.fn(),
  getChoreOccurrenceOverrideMock: vi.fn(),
  insertChoreMock: vi.fn(),
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
  getChoreInHousehold: getChoreInHouseholdMock,
  getChoreOccurrenceOverride: getChoreOccurrenceOverrideMock,
  insertChore: insertChoreMock,
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

import { listChores, mutateChore } from "@/lib/services";

describe("mutateChore", () => {
  beforeEach(() => {
    deleteChoreOccurrenceOverrideMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceOverrideMock.mockReset();
    insertChoreMock.mockReset();
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
        type: "close_on_done",
      }),
    );
  });

  it("creates stay-open chore when requested", async () => {
    insertChoreMock.mockResolvedValue(92);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "create",
        title: "Water plants",
        type: "stay_open",
        startDate: "2026-01-02",
        endDate: "2026-01-03",
        repeatRule: "week",
      },
    });

    expect(result.ok).toBe(true);
    expect(insertChoreMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "stay_open",
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
    getChoreInHouseholdMock.mockResolvedValue(null);

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
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "close_on_done" });
    getChoreOccurrenceOverrideMock.mockResolvedValue({
      status: "closed",
      closedReason: "done",
      undoUntil: new Date(Date.now() + 5_000),
    });

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

  it("rejects undo when the undo window expired", async () => {
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "close_on_done" });
    getChoreOccurrenceOverrideMock.mockResolvedValue({
      status: "closed",
      closedReason: "done",
      undoUntil: new Date(Date.now() - 1000),
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "undo",
        choreId: 3,
        occurrenceDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: "Undo window expired",
      },
    });
    expect(deleteChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects undo when action is no longer undoable", async () => {
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "close_on_done" });
    getChoreOccurrenceOverrideMock.mockResolvedValue(null);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "undo",
        choreId: 3,
        occurrenceDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: "Undo window expired",
      },
    });
    expect(deleteChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects unknown actions", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "invalid",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "Action must be create, set, or undo",
      },
    });
  });

  it("requires explicit open/closed status for set action", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "Status must be open or closed",
      },
    });
  });

  it("closes close-on-done chore occurrence on completion", async () => {
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "close_on_done" });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result.ok).toBe(true);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
        closedReason: "done",
      }),
    );
  });

  it("keeps stay-open chore occurrence open when logging completion", async () => {
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "stay_open" });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result.ok).toBe(true);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
  });

  it("allows repeated completion logs for stay-open chores", async () => {
    getChoreInHouseholdMock.mockResolvedValue({ id: 3, type: "stay_open" });

    const first = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
      },
    });
    const second = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenCalledTimes(2);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        choreId: 3,
        occurrenceDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
  });
});

describe("listChores", () => {
  beforeEach(() => {
    deleteChoreOccurrenceOverrideMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceOverrideMock.mockReset();
    insertChoreMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreOverridesByHouseholdMock.mockReset();
    upsertChoreOccurrenceOverrideMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
  });

  it("keeps undo active for stay-open completion overrides", async () => {
    listActiveChoreSeriesByHouseholdMock.mockResolvedValue([
      {
        id: 7,
        title: "Water plants",
        type: "stay_open",
        start_date: "2026-01-03",
        end_date: "2026-01-03",
        series_end_date: null,
        repeat_rule: "none",
        status: "active",
        notes: null,
      },
    ]);
    listChoreOverridesByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_date: "2026-01-03",
        status: "open",
        closed_reason: "done",
        undo_until: new Date(Date.now() + 10_000),
      },
    ]);

    const result = await listChores({
      householdId: 11,
      weekOffset: 0,
      start: "2026-01-03",
      end: "2026-01-03",
    });

    expect(result.chores).toHaveLength(1);
    expect(result.chores[0]).toEqual(
      expect.objectContaining({
        id: 7,
        type: "stay_open",
        status: "open",
        closed_reason: "done",
        can_undo: true,
      }),
    );
  });
});
