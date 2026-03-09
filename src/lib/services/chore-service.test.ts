import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  deleteChoreOccurrenceExceptionMock,
  getChoreInHouseholdMock,
  getChoreOccurrenceExceptionMock,
  insertChoreMock,
  listActiveChoreSeriesByHouseholdMock,
  listChoreExceptionsByHouseholdMock,
  updateChoreSeriesMock,
  updateChoreSeriesEndDateMock,
  upsertChoreOccurrenceExceptionMock,
  getHouseholdTimeZoneByIdMock,
  normalizeRepeatRuleMock,
  validateChoreCreateMock,
  toISODateOrThrowMock,
} = vi.hoisted(() => ({
  deleteChoreOccurrenceExceptionMock: vi.fn(),
  getChoreInHouseholdMock: vi.fn(),
  getChoreOccurrenceExceptionMock: vi.fn(),
  insertChoreMock: vi.fn(),
  listActiveChoreSeriesByHouseholdMock: vi.fn(),
  listChoreExceptionsByHouseholdMock: vi.fn(),
  updateChoreSeriesMock: vi.fn(),
  updateChoreSeriesEndDateMock: vi.fn(),
  upsertChoreOccurrenceExceptionMock: vi.fn(),
  getHouseholdTimeZoneByIdMock: vi.fn(),
  normalizeRepeatRuleMock: vi.fn(),
  validateChoreCreateMock: vi.fn(),
  toISODateOrThrowMock: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  deleteChoreOccurrenceException: deleteChoreOccurrenceExceptionMock,
  getChoreInHousehold: getChoreInHouseholdMock,
  getChoreOccurrenceException: getChoreOccurrenceExceptionMock,
  insertChore: insertChoreMock,
  listActiveChoreSeriesByHousehold: listActiveChoreSeriesByHouseholdMock,
  listChoreExceptionsByHousehold: listChoreExceptionsByHouseholdMock,
  updateChoreSeries: updateChoreSeriesMock,
  updateChoreSeriesEndDate: updateChoreSeriesEndDateMock,
  upsertChoreOccurrenceException: upsertChoreOccurrenceExceptionMock,
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
    deleteChoreOccurrenceExceptionMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceExceptionMock.mockReset();
    insertChoreMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreExceptionsByHouseholdMock.mockReset();
    updateChoreSeriesMock.mockReset();
    updateChoreSeriesEndDateMock.mockReset();
    upsertChoreOccurrenceExceptionMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    validateChoreCreateMock.mockReturnValue({});
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
    toISODateOrThrowMock.mockReturnValue("2026-01-01");
    getChoreOccurrenceExceptionMock.mockResolvedValue(null);
    listChoreExceptionsByHouseholdMock.mockResolvedValue([]);
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
        error: "Action must be create, set, cancel, edit_single, edit_following, or edit_series",
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

  it("clears stored exception when setting an occurrence back to open", async () => {
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
        status: "open",
      },
    });

    expect(result.ok).toBe(true);
    expect(deleteChoreOccurrenceExceptionMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-03",
    });
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
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
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        kind: "state",
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
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
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
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        kind: "state",
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
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenCalledTimes(2);
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        kind: "state",
        status: "open",
        closedReason: "done",
      }),
    );
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        kind: "state",
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
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-05",
      kind: "canceled",
      status: null,
      closedReason: null,
    });
    expect(updateChoreSeriesEndDateMock).not.toHaveBeenCalled();
  });

  it("creates a detached one-off chore for edit_single", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      title: "Kitchen",
      type: "close_on_done",
      start_date: "2026-01-01",
      end_date: "2026-01-02",
      series_end_date: null,
      repeat_rule: "day",
      notes: "Original notes",
    });
    insertChoreMock.mockResolvedValue(44);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "edit_single",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        title: "Kitchen deep clean",
        notes: "Use stronger spray",
      },
    });

    expect(result).toEqual({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        createdChoreId: 44,
        occurrenceStartDate: "2026-01-05",
        action: "edit_single",
      },
    });
    expect(upsertChoreOccurrenceExceptionMock).toHaveBeenCalledWith({
      choreId: 3,
      occurrenceStartDate: "2026-01-05",
      kind: "canceled",
      status: null,
      closedReason: null,
    });
    expect(insertChoreMock).toHaveBeenCalledWith({
      householdId: 11,
      title: "Kitchen deep clean",
      type: "close_on_done",
      startDate: "2026-01-05",
      endDate: "2026-01-06",
      seriesEndDate: null,
      repeatRule: "none",
      notes: "Use stronger spray",
    });
  });

  it("splits the series and inserts a future branch for edit_following", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      title: "Kitchen",
      type: "close_on_done",
      start_date: "2026-01-01",
      end_date: "2026-01-02",
      series_end_date: null,
      repeat_rule: "day",
      notes: "Original notes",
    });
    insertChoreMock.mockResolvedValue(45);

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "edit_following",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        title: "Kitchen weekends",
        repeatRule: "week",
        seriesEndDate: "2026-02-28",
      },
    });

    expect(result).toEqual({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        createdChoreId: 45,
        occurrenceStartDate: "2026-01-05",
        action: "edit_following",
      },
    });
    expect(updateChoreSeriesEndDateMock).toHaveBeenCalledWith({
      choreId: 3,
      seriesEndDate: "2026-01-04",
    });
    expect(insertChoreMock).toHaveBeenCalledWith({
      householdId: 11,
      title: "Kitchen weekends",
      type: "close_on_done",
      startDate: "2026-01-05",
      endDate: "2026-01-06",
      seriesEndDate: "2026-02-28",
      repeatRule: "week",
      notes: "Original notes",
    });
  });

  it("rejects edit_following for non-repeating chores", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      title: "Kitchen",
      type: "close_on_done",
      ...scheduledSingleDaySeries,
      repeat_rule: "none",
      notes: null,
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "edit_following",
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
        error: "edit_following requires a repeating chore",
      },
    });
    expect(insertChoreMock).not.toHaveBeenCalled();
  });

  it("updates the existing series in place for edit_series", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      title: "Kitchen",
      type: "close_on_done",
      start_date: "2026-01-01",
      end_date: "2026-01-02",
      series_end_date: "2026-02-28",
      repeat_rule: "day",
      notes: "Original notes",
    });

    const result = await mutateChore({
      householdId: 11,
      payload: {
        action: "edit_series",
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        title: "Kitchen reset",
        notes: "Fresh supplies",
        repeatRule: "biweek",
        seriesEndDate: "2026-03-31",
      },
    });

    expect(result).toEqual({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        occurrenceStartDate: "2026-01-05",
        action: "edit_series",
      },
    });
    expect(updateChoreSeriesMock).toHaveBeenCalledWith({
      choreId: 3,
      title: "Kitchen reset",
      type: "close_on_done",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      seriesEndDate: "2026-03-31",
      repeatRule: "biweek",
      notes: "Fresh supplies",
    });
    expect(insertChoreMock).not.toHaveBeenCalled();
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
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
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
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
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects set for a canceled occurrence", async () => {
    getChoreInHouseholdMock.mockResolvedValue({
      id: 3,
      type: "close_on_done",
      ...scheduledSingleDaySeries,
    });
    getChoreOccurrenceExceptionMock.mockResolvedValue({
      chore_id: 3,
      occurrence_start_date: "2026-01-03",
      kind: "canceled",
      status: null,
      closed_reason: null,
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
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
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
    expect(upsertChoreOccurrenceExceptionMock).not.toHaveBeenCalled();
  });
});

describe("listChores", () => {
  beforeEach(() => {
    deleteChoreOccurrenceExceptionMock.mockReset();
    getChoreInHouseholdMock.mockReset();
    getChoreOccurrenceExceptionMock.mockReset();
    insertChoreMock.mockReset();
    listActiveChoreSeriesByHouseholdMock.mockReset();
    listChoreExceptionsByHouseholdMock.mockReset();
    updateChoreSeriesMock.mockReset();
    updateChoreSeriesEndDateMock.mockReset();
    upsertChoreOccurrenceExceptionMock.mockReset();
    getHouseholdTimeZoneByIdMock.mockReset();
    normalizeRepeatRuleMock.mockReset();
    validateChoreCreateMock.mockReset();
    toISODateOrThrowMock.mockReset();

    normalizeRepeatRuleMock.mockImplementation((value: string) => value);
    getHouseholdTimeZoneByIdMock.mockResolvedValue("UTC");
    listChoreExceptionsByHouseholdMock.mockResolvedValue([]);
  });

  it("keeps stay-open completion overrides open in list output", async () => {
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
    listChoreExceptionsByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_start_date: "2026-01-03",
        kind: "state",
        status: "open",
        closed_reason: "done",
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
    listChoreExceptionsByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_start_date: "2026-01-03",
        kind: "state",
        status: "closed",
        closed_reason: "done",
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
      }),
      expect.objectContaining({
        id: 7,
        occurrence_date: "2026-01-04",
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
      }),
      expect.objectContaining({
        id: 7,
        occurrence_date: "2026-01-05",
        occurrence_start_date: "2026-01-03",
        status: "closed",
        closed_reason: "done",
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
    listChoreExceptionsByHouseholdMock.mockResolvedValue([
      {
        chore_id: 7,
        occurrence_start_date: "2026-01-05",
        kind: "canceled",
        status: null,
        closed_reason: null,
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
