import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const { getSessionMock, listChoresMock, mutateChoreMock, resolveActiveHouseholdMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    listChoresMock: vi.fn(),
    mutateChoreMock: vi.fn(),
    resolveActiveHouseholdMock: vi.fn(),
  }),
);

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/services", () => ({
  listChores: listChoresMock,
  mutateChore: mutateChoreMock,
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

import { GET, PATCH } from "@/app/api/chores/route";

describe("GET /api/chores", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listChoresMock.mockReset();
    mutateChoreMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
  });

  it("passes integer week offsets through to listChores", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    listChoresMock.mockResolvedValue({
      timeZone: "UTC",
      rangeStart: "2026-01-01",
      rangeEnd: "2026-01-07",
      chores: [],
    });

    const response = await GET(new Request("http://localhost/api/chores?weekOffset=3"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(listChoresMock).toHaveBeenCalledWith({
      householdId: 11,
      weekOffset: 3,
      start: null,
      end: null,
    });
  });

  it("defaults to weekOffset=0 when query value is not an integer", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    listChoresMock.mockResolvedValue({
      timeZone: "UTC",
      rangeStart: "2026-01-01",
      rangeEnd: "2026-01-07",
      chores: [],
    });

    await GET(new Request("http://localhost/api/chores?weekOffset=1.5"));

    expect(listChoresMock).toHaveBeenCalledWith({
      householdId: 11,
      weekOffset: 0,
      start: null,
      end: null,
    });
  });

  it("clamps weekOffset to supported bounds", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    listChoresMock.mockResolvedValue({
      timeZone: "UTC",
      rangeStart: "2026-01-01",
      rangeEnd: "2026-01-07",
      chores: [],
    });

    await GET(new Request("http://localhost/api/chores?weekOffset=9999"));
    await GET(new Request("http://localhost/api/chores?weekOffset=-9999"));

    expect(listChoresMock).toHaveBeenNthCalledWith(1, {
      householdId: 11,
      weekOffset: 520,
      start: null,
      end: null,
    });
    expect(listChoresMock).toHaveBeenNthCalledWith(2, {
      householdId: 11,
      weekOffset: -520,
      start: null,
      end: null,
    });
  });
});

describe("PATCH /api/chores", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listChoresMock.mockReset();
    mutateChoreMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
  });

  it("allows repeated stay-open log calls", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    mutateChoreMock.mockResolvedValue({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        type: "stay_open",
        status: "open",
        closed_reason: "done",
      },
    });

    const payload = {
      action: "set",
      choreId: 3,
      occurrenceStartDate: "2026-01-03",
      status: "closed",
    };

    const request = () =>
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    const firstResponse = await PATCH(request());
    const secondResponse = await PATCH(request());
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(secondBody.ok).toBe(true);
    expect(mutateChoreMock).toHaveBeenCalledTimes(2);
    expect(mutateChoreMock).toHaveBeenNthCalledWith(1, {
      householdId: 11,
      payload,
    });
    expect(mutateChoreMock).toHaveBeenNthCalledWith(2, {
      householdId: 11,
      payload,
    });
  });

  it("rejects unsupported action values before service mutation", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });

    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Action must be create, set, undo, or cancel",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });

  it("rejects missing status for set-style mutations before service mutation", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });

    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", choreId: 3, occurrenceStartDate: "2026-01-03" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      error: "Status must be open or closed",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });
});
