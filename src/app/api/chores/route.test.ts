import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";
import { HouseholdMutationBusyError } from "@/lib/household-mutation-error";
import { HouseholdNotFoundError } from "@/lib/repositories";

const {
  getSessionMock,
  listChoresMock,
  mutateChoreMock,
  reconcileActiveHouseholdSessionMock,
  resolveActiveHouseholdMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  listChoresMock: vi.fn(),
  mutateChoreMock: vi.fn(),
  reconcileActiveHouseholdSessionMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/services/active-household-service", () => ({
  reconcileActiveHouseholdSession: reconcileActiveHouseholdSessionMock,
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

vi.mock("@/lib/services/chore-service", () => ({
  listChores: listChoresMock,
  mutateChore: mutateChoreMock,
}));

import { GET, PATCH } from "@/app/api/chores/route";

describe("GET /api/chores", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listChoresMock.mockReset();
    mutateChoreMock.mockReset();
    reconcileActiveHouseholdSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();

    reconcileActiveHouseholdSessionMock.mockResolvedValue(new Headers());
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

  it("maps missing-household races to household not found", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    listChoresMock.mockRejectedValue(new HouseholdNotFoundError(11));

    const response = await GET(new Request("http://localhost/api/chores?weekOffset=0"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
      error: "Household not found",
    });
  });
});

describe("PATCH /api/chores", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listChoresMock.mockReset();
    mutateChoreMock.mockReset();
    reconcileActiveHouseholdSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();

    reconcileActiveHouseholdSessionMock.mockResolvedValue(new Headers());
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
      data: {
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
      actorUserId: 21,
      payload,
    });
    expect(mutateChoreMock).toHaveBeenNthCalledWith(2, {
      householdId: 11,
      actorUserId: 21,
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
      code: API_ERROR_CODE.ACTION_INVALID,
      error: "Action must be create, set, cancel, or edit",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });

  it("preserves reconciliation cookies on a retryable mutation-lock conflict", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11, role: "owner" },
    });
    reconcileActiveHouseholdSessionMock.mockResolvedValue(
      new Headers({ "set-cookie": "session=healed" }),
    );
    mutateChoreMock.mockRejectedValueOnce(new HouseholdMutationBusyError());
    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          scope: "single",
          choreId: 3,
          occurrenceStartDate: "2026-01-03",
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("HOUSEHOLD_MUTATION_BUSY");
    expect(response.headers.get("set-cookie")).toBe("session=healed");
  });

  it("returns forbidden when transaction-time permission revalidation rejects the edit", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11, role: "owner" },
    });
    mutateChoreMock.mockResolvedValueOnce({
      ok: false,
      code: "FORBIDDEN",
      error: "Household chore access changed. Please reload.",
    });
    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          scope: "single",
          choreId: 3,
          occurrenceStartDate: "2026-01-03",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it.each(["single", "following"])(
    "returns top-level replacement identity for %s edits",
    async (scope) => {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "11" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: { id: 11, role: "owner" },
      });
      const payload = {
        action: "edit",
        scope,
        choreId: 3,
        occurrenceStartDate: "2026-01-03",
        title: "Deep clean",
      };
      mutateChoreMock.mockResolvedValue({
        ok: true,
        data: { choreId: 3, createdChoreId: 9, occurrenceStartDate: "2026-01-03" },
      });

      const response = await PATCH(
        new Request("http://localhost/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        choreId: 3,
        createdChoreId: 9,
        occurrenceStartDate: "2026-01-03",
      });
      expect(mutateChoreMock).toHaveBeenCalledWith({ householdId: 11, actorUserId: 21, payload });
    },
  );

  it("rejects chore edit mutations for members when household settings disable them", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11, role: "member", membersCanManageChores: false },
    });

    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          scope: "single",
          choreId: 3,
          occurrenceStartDate: "2026-01-03",
          title: "Deep clean",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Members cannot add, edit, or delete chores in this household",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });

  it("rejects chore creation for members when household settings disable chore management", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11, role: "member", membersCanManageChores: false },
    });

    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: "Deep clean",
          type: "close_on_done",
          startDate: "2026-01-03",
          endDate: "2026-01-04",
          repeatRule: "none",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Members cannot add, edit, or delete chores in this household",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });

  it("forwards edit payloads with all scope to the service", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "21" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 11 },
    });
    const payload = {
      action: "edit",
      scope: "all",
      choreId: 3,
      occurrenceStartDate: "2026-01-03",
      title: "Deep clean forever",
    };
    mutateChoreMock.mockResolvedValue({
      ok: true,
      data: { choreId: 3, occurrenceStartDate: "2026-01-03" },
    });

    const response = await PATCH(
      new Request("http://localhost/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(mutateChoreMock).toHaveBeenCalledWith({ householdId: 11, actorUserId: 21, payload });
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
      code: API_ERROR_CODE.STATUS_INVALID,
      error: "Status must be open or closed",
    });
    expect(mutateChoreMock).not.toHaveBeenCalled();
  });
});
