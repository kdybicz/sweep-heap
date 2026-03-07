import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  deleteChoreOccurrenceOverrideMock,
  getChoreInHouseholdMock,
  getChoreOccurrenceExclusionMock,
  getChoreOccurrenceOverrideMock,
  insertChoreMock,
  listActiveChoreSeriesByHouseholdMock,
  listChoreExclusionsByHouseholdMock,
  listChoreOverridesByHouseholdMock,
  updateChoreSeriesEndDateMock,
  upsertChoreOccurrenceExclusionMock,
  upsertChoreOccurrenceOverrideMock,
  getHouseholdTimeZoneByIdMock,
  normalizeRepeatRuleMock,
  validateChoreCreateMock,
  toISODateOrThrowMock,
} = vi.hoisted(() => ({
  deleteChoreOccurrenceOverrideMock: vi.fn(),
  getChoreInHouseholdMock: vi.fn(),
  getChoreOccurrenceExclusionMock: vi.fn(),
  getChoreOccurrenceOverrideMock: vi.fn(),
  insertChoreMock: vi.fn(),
  listActiveChoreSeriesByHouseholdMock: vi.fn(),
  listChoreExclusionsByHouseholdMock: vi.fn(),
  listChoreOverridesByHouseholdMock: vi.fn(),
  updateChoreSeriesEndDateMock: vi.fn(),
  upsertChoreOccurrenceExclusionMock: vi.fn(),
  upsertChoreOccurrenceOverrideMock: vi.fn(),
  getHouseholdTimeZoneByIdMock: vi.fn(),
  normalizeRepeatRuleMock: vi.fn(),
  validateChoreCreateMock: vi.fn(),
  toISODateOrThrowMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  deleteChoreOccurrenceOverride: deleteChoreOccurrenceOverrideMock,
  getChoreInHousehold: getChoreInHouseholdMock,
  getChoreOccurrenceExclusion: getChoreOccurrenceExclusionMock,
  getChoreOccurrenceOverride: getChoreOccurrenceOverrideMock,
  insertChore: insertChoreMock,
  listActiveChoreSeriesByHousehold: listActiveChoreSeriesByHouseholdMock,
  listChoreExclusionsByHousehold: listChoreExclusionsByHouseholdMock,
  listChoreOverridesByHousehold: listChoreOverridesByHouseholdMock,
  updateChoreSeriesEndDate: updateChoreSeriesEndDateMock,
  upsertChoreOccurrenceExclusion: upsertChoreOccurrenceExclusionMock,
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

const scheduledSingleDaySeries = {
  start_date: "2026-01-03",
  end_date: "2026-01-04",
  series_end_date: null,
  repeat_rule: "none",
} as const;

const scheduledMultiDaySeries = {
  start_date: "2026-01-03",
  end_date: "2026-01-06",
  series_end_date: null,
  repeat_rule: "none",
} as const;

describe("mutateChore", () => {
  beforeEach(() => {
    deleteChoreOccurrenceOverrideMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceExclusionMock.mockReset();
    getChoreOccurrenceOverrideMock.mockReset();
    insertChoreMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreExclusionsByHouseholdMock.mockReset();
    listChoreOverridesByHouseholdMock.mockReset();
    updateChoreSeriesEndDateMock.mockReset();
    upsertChoreOccurrenceExclusionMock.mockReset();
    upsertChoreOccurrenceOverrideMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    validateChoreCreateMock.mockReturnValue({});
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
    toISODateOrThrowMock.mockReturnValue("2026-01-01");
    getChoreOccurrenceExclusionMock.mockResolvedValue(null);
    listChoreExclusionsByHouseholdMock.mockResolvedValue([]);
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
        code: API_ERROR_CODE.VALIDATION_FAILED,
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
        code: API_ERROR_CODE.MISSING_CHORE_OCCURRENCE,
        error: "Missing choreId or occurrenceStartDate",
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
        occurrenceStartDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      body: {
        ok: false,
        code: API_ERROR_CODE.CHORE_NOT_FOUND,
        error: "Chore not found",
      },
    });
  });

  it("deletes override on undo action", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });
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
        occurrenceStartDate: "2026-01-03",
      },
    });

    expect(result.ok).toBe(true);
    expect(deleteChoreOccurrenceOverrideMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-03",
    });
    expect(upsertChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects undo when the undo window expired", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });
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
        occurrenceStartDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.UNDO_WINDOW_EXPIRED,
        error: "Undo window expired",
      },
    });
    expect(deleteChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects undo when action is no longer undoable", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });
    getChoreOccurrenceOverrideMock.mockResolvedValue(null);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "undo",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.UNDO_WINDOW_EXPIRED,
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
        code: API_ERROR_CODE.ACTION_INVALID,
        error: "Action must be create, set, undo, or cancel",
      },
    });
  });

  it("requires explicit open/closed status for set action", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        code: API_ERROR_CODE.STATUS_INVALID,
        error: "Status must be open or closed",
      },
    });
  });

  it("closes close-on-done chore occurrence on completion", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result.ok).toBe(true);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "closed",
        closedReason: "done",
      }),
    );
  });

  it("requires the occurrence start date for multi-day chore mutations", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledMultiDaySeries,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-04",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE,
        error: "Occurrence start date is outside chore schedule",
      },
    });
    expect(upsertChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("keeps stay-open chore occurrence open when logging completion", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "stay_open",
      ...scheduledSingleDaySeries,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result.ok).toBe(true);
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
  });

  it("allows repeated completion logs for stay-open chores", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "stay_open",
      ...scheduledSingleDaySeries,
    });

    const first = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "closed",
      },
    });
    const second = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
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
        occurrenceStartDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
    expect(upsertChoreOccurrenceOverrideMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "open",
        closedReason: "done",
      }),
    );
  });

  it("rejects cancel when cancelScope is missing", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "cancel",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
        error: "cancelScope must be single or following",
      },
    });
    expect(getChoreInHouseholdMock).not.toHaveBeenCalled();
  });

  it("rejects cancel when cancelScope is invalid", async () => {
    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "cancel",
        cancelScope: "everything",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        ok: false,
        code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
        error: "cancelScope must be single or following",
      },
    });
    expect(getChoreInHouseholdMock).not.toHaveBeenCalled();
  });

  it("cancels only one occurrence when cancelScope=single", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      start_date: "2026-01-01",
      end_date: "2026-01-01",
      series_end_date: null,
      repeat_rule: "day",
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "cancel",
        cancelScope: "single",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
      },
    });

    expect(result).toEqual({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        cancelScope: "single",
      },
    });
    expect(upsertChoreOccurrenceExclusionMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-05",
    });
    expect(deleteChoreOccurrenceOverrideMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-05",
    });
    expect(updateChoreSeriesEndDateMock).not.toHaveBeenCalled();
  });

  it("cancels this and following occurrences when cancelScope=following", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      start_date: "2026-01-01",
      end_date: "2026-01-01",
      series_end_date: null,
      repeat_rule: "day",
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "cancel",
        cancelScope: "following",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
      },
    });

    expect(result).toEqual({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        cancelScope: "following",
      },
    });
    expect(updateChoreSeriesEndDateMock).toHaveBeenCalledWith({
      choreId: 3,
      seriesEndDate: "2026-01-04",
    });
    expect(upsertChoreOccurrenceExclusionMock).not.toHaveBeenCalled();
  });

  it("rejects cancelScope=following for non-repeating chores", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
      repeat_rule: "none",
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "cancel",
        cancelScope: "following",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.CANCEL_SCOPE_INVALID,
        error: "cancelScope following requires a repeating chore",
      },
    });
    expect(updateChoreSeriesEndDateMock).not.toHaveBeenCalled();
    expect(upsertChoreOccurrenceExclusionMock).not.toHaveBeenCalled();
  });

  it("rejects set for a canceled occurrence", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });
    getChoreOccurrenceExclusionMock.mockResolvedValue({
      occurrence_start_date: "2026-01-03",
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.OCCURRENCE_CANCELED,
        error: "Occurrence is canceled",
      },
    });
    expect(upsertChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects set when occurrence date is outside the chore schedule", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "set",
        choreId: 3,
        occurrenceStartDate: "2026-01-04",
        status: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE,
        error: "Occurrence start date is outside chore schedule",
      },
    });
    expect(upsertChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects undo when occurrence date is outside the chore schedule", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "undo",
        choreId: 3,
        occurrenceStartDate: "2026-01-04",
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE,
        error: "Occurrence start date is outside chore schedule",
      },
    });
    expect(getChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
    expect(deleteChoreOccurrenceOverrideMock).not.toHaveBeenCalled();
  });
});

describe("listChores", () => {
  beforeEach(() => {
    deleteChoreOccurrenceOverrideMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceExclusionMock.mockReset();
    getChoreOccurrenceOverrideMock.mockReset();
    insertChoreMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreExclusionsByHouseholdMock.mockReset();
    listChoreOverridesByHouseholdMock.mockReset();
    updateChoreSeriesEndDateMock.mockReset();
    upsertChoreOccurrenceExclusionMock.mockReset();
    upsertChoreOccurrenceOverrideMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
    listChoreExclusionsByHouseholdMock.mockResolvedValue([]);
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
        occurrence_start_date: "2026-01-03",
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
        occurrence_start_date: "2026-01-03",
        can_undo: true,
      }),
    );
  });

  it("returns one row per day for a multi-day occurrence with shared occurrence identity", async () => {
    listActiveChoreSeriesByHouseholdMock.mockResolvedValue([
      {
        id: 7,
        title: "Guest prep",
        type: "close_on_done",
        ...scheduledMultiDaySeries,
        status: "active",
        notes: null,
      },
    ]);
    listChoreOverridesByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
        undo_until: new Date(Date.now() + 10_000),
      },
    ]);

    const result = await listChores({
      householdId: 11,
      weekOffset: 0,
      start: "2026-01-03",
      end: "2026-01-05",
    });

    expect(result.chores).toHaveLength(3);
    expect(result.chores).toEqual([
      expect.objectContaining({
        id: 7,
        occurrence_date: "2026-01-03",
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
        can_undo: true,
      }),
      expect.objectContaining({
        id: 7,
        occurrence_date: "2026-01-04",
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
        can_undo: true,
      }),
      expect.objectContaining({
        id: 7,
        occurrence_date: "2026-01-05",
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
        can_undo: true,
      }),
    ]);
  });

  it("omits occurrences excluded by single-cancel rules", async () => {
    listActiveChoreSeriesByHouseholdMock.mockResolvedValue([
      {
        id: 7,
        title: "Water plants",
        type: "stay_open",
        start_date: "2026-01-01",
        end_date: "2026-01-01",
        series_end_date: null,
        repeat_rule: "day",
        status: "active",
        notes: null,
      },
    ]);
    listChoreOverridesByHouseholdMock.mockResolvedValue([]);
    listChoreExclusionsByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_start_date: "2026-01-05",
      },
    ]);

    const result = await listChores({
      householdId: 11,
      weekOffset: 0,
      start: "2026-01-05",
      end: "2026-01-05",
    });

    expect(result.chores).toEqual([]);
  });
});
