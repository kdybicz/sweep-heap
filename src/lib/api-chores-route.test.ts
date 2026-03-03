import { describe, expect, it, vi } from "vitest";

const { getSessionMock, getActiveHouseholdIdMock, mutateChoreMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getActiveHouseholdIdMock: vi.fn(),
  mutateChoreMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getActiveHouseholdId: getActiveHouseholdIdMock,
}));

vi.mock("@/lib/services", () => ({
  listChores: vi.fn(),
  mutateChore: mutateChoreMock,
}));

import { PATCH } from "@/app/api/chores/route";

describe("PATCH /api/chores", () => {
  it("allows repeated stay-open log calls", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    getActiveHouseholdIdMock.mockResolvedValue(11);
    mutateChoreMock.mockResolvedValue({
      ok: true,
      body: {
        ok: true,
        choreId: 3,
        occurrenceDate: "2026-01-03",
        type: "stay_open",
        status: "open",
        closed_reason: "done",
      },
    });

    const payload = {
      action: "set",
      choreId: 3,
      occurrenceDate: "2026-01-03",
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
});
