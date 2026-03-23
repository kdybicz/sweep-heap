import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODE } from "@/lib/api-error";

const {
  deleteOrganizationMock,
  householdHasOtherActiveMembersMock,
  setActiveOrganizationMock,
  getSessionMock,
  createHouseholdWithOwnerMock,
  listActiveHouseholdsForUserMock,
  reconcileActiveHouseholdAfterMembershipMutationMock,
  reconcileActiveHouseholdSessionMock,
  resolveActiveHouseholdMock,
  updateHouseholdByIdMock,
  withHouseholdMutationLockMock,
} = vi.hoisted(() => ({
  deleteOrganizationMock: vi.fn(),
  householdHasOtherActiveMembersMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  getSessionMock: vi.fn(),
  createHouseholdWithOwnerMock: vi.fn(),
  listActiveHouseholdsForUserMock: vi.fn(),
  reconcileActiveHouseholdAfterMembershipMutationMock: vi.fn(),
  reconcileActiveHouseholdSessionMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
  updateHouseholdByIdMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      deleteOrganization: deleteOrganizationMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  createHouseholdWithOwner: createHouseholdWithOwnerMock,
  listActiveHouseholdsForUser: listActiveHouseholdsForUserMock,
  updateHouseholdById: updateHouseholdByIdMock,
}));

vi.mock("@/lib/services/active-household-service", () => ({
  reconcileActiveHouseholdAfterMembershipMutation:
    reconcileActiveHouseholdAfterMembershipMutationMock,
  reconcileActiveHouseholdSession: reconcileActiveHouseholdSessionMock,
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

vi.mock("@/lib/services/ownership-guard-service", () => ({
  householdHasOtherActiveMembers: householdHasOtherActiveMembersMock,
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/households/route";

const requestWithBody = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) =>
  new Request("http://localhost/api/households", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const requestWithRawBody = (method: "POST" | "PATCH", rawBody: string) =>
  new Request("http://localhost/api/households", {
    method,
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });

const getRequest = () => new Request("http://localhost/api/households");

describe("/api/households route", () => {
  beforeEach(() => {
    deleteOrganizationMock.mockReset();
    householdHasOtherActiveMembersMock.mockReset();
    setActiveOrganizationMock.mockReset();
    getSessionMock.mockReset();
    createHouseholdWithOwnerMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
    reconcileActiveHouseholdAfterMembershipMutationMock.mockReset();
    reconcileActiveHouseholdSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
    updateHouseholdByIdMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

    deleteOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=deleted; Path=/; HttpOnly",
        },
      }),
    );
    householdHasOtherActiveMembersMock.mockResolvedValue(false);
    listActiveHouseholdsForUserMock.mockResolvedValue([]);
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household/setup",
      resolution: { status: "none" },
      responseHeaders: new Headers(),
    });
    reconcileActiveHouseholdSessionMock.mockResolvedValue(new Headers());
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });
    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=abc; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("GET returns active household for authenticated user", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: "11" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 11,
        name: "Home",
        timeZone: "Europe/Warsaw",
        icon: "🏡",
        role: "admin",
      },
    });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      household: {
        id: 11,
        name: "Home",
        timeZone: "Europe/Warsaw",
        icon: "🏡",
        role: "admin",
      },
    });
  });

  it("GET returns household required when user has no active household", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Household required",
      code: API_ERROR_CODE.HOUSEHOLD_REQUIRED,
    });
  });

  it("DELETE preserves reconciliation cookies when household access healing returns non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "7" },
        session: { activeOrganizationId: "11" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });
      const reconciliationError = new Error("set active failed") as Error & {
        responseHeaders?: Headers;
      };
      reconciliationError.responseHeaders = new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      });
      reconcileActiveHouseholdSessionMock.mockRejectedValueOnce(reconciliationError);

      const response = await DELETE(
        new Request("http://localhost/api/households", { method: "DELETE" }),
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        ok: false,
        error: "Household required",
        code: API_ERROR_CODE.HOUSEHOLD_REQUIRED,
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household session",
        reconciliationError,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("GET returns invalid user when session user id is not numeric", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "not-a-number" } });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
  });

  it("GET returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "7" } });
      resolveActiveHouseholdMock.mockRejectedValue(new Error("db failed"));

      const response = await GET(getRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to load household",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST normalizes icon and creates household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    createHouseholdWithOwnerMock.mockResolvedValue(100);

    const response = await POST(
      requestWithBody("POST", {
        name: "  The Heap  ",
        timeZone: "UTC",
        icon: "  🧹🧹🧹🧹🧹🧹🧹🧹🧹  ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, householdId: 100 });
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        name: "The Heap",
        timeZone: "UTC",
        icon: "🧹🧹🧹🧹🧹🧹🧹🧹",
      }),
    );
    expect(createHouseholdWithOwnerMock.mock.calls[0]?.[0]?.slug).toMatch(/^the-heap-/);
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "100",
      },
      headers: expect.any(Headers),
    });
  });

  it("POST still creates a household for users who already belong to another one", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });
    createHouseholdWithOwnerMock.mockResolvedValue(101);

    const response = await POST(
      requestWithBody("POST", {
        name: "Side Project",
        timeZone: "UTC",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, householdId: 101 });
    expect(createHouseholdWithOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        name: "Side Project",
      }),
    );
  });

  it("POST fails when switching the active household fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 77,
          name: "Main House",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(102);
      setActiveOrganizationMock.mockRejectedValueOnce(new Error("session update failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
      expect(createHouseholdWithOwnerMock).toHaveBeenCalled();
      expect(deleteOrganizationMock).toHaveBeenCalledWith({
        asResponse: true,
        body: {
          organizationId: "102",
        },
        headers: expect.any(Headers),
      });
      expect(setActiveOrganizationMock).toHaveBeenNthCalledWith(2, {
        asResponse: true,
        body: {
          organizationId: "77",
        },
        headers: expect.any(Headers),
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to set active household after create",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST treats non-ok activation response as failure and rolls back create", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 77,
          name: "Main House",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(103);
      setActiveOrganizationMock.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=failed-activate; Path=/; HttpOnly",
          },
        }),
      );

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=failed-activate");
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=abc");
      expect(deleteOrganizationMock).toHaveBeenCalledWith({
        asResponse: true,
        body: {
          organizationId: "103",
        },
        headers: expect.any(Headers),
      });
      expect(setActiveOrganizationMock).toHaveBeenNthCalledWith(2, {
        asResponse: true,
        body: {
          organizationId: "77",
        },
        headers: expect.any(Headers),
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to set active household after create",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST returns dedicated rollback error when activation and rollback both fail", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 77,
          name: "Main House",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(104);
      setActiveOrganizationMock.mockRejectedValue(new Error("session update failed"));
      deleteOrganizationMock.mockRejectedValue(new Error("rollback failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household and roll back create",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to set active household after create",
        expect.any(Error),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to roll back household after create activation failure",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST returns dedicated rollback error when rollback returns non-ok response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 77,
          name: "Main House",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(105);
      setActiveOrganizationMock.mockRejectedValue(new Error("session update failed"));
      deleteOrganizationMock.mockResolvedValue(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=deleted; Path=/; HttpOnly",
          },
        }),
      );

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household and roll back create",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to roll back household after create activation failure",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST returns dedicated rollback error when restoring previous active household fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 77,
          name: "Main House",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(106);
      setActiveOrganizationMock
        .mockRejectedValueOnce(new Error("session update failed"))
        .mockResolvedValueOnce(new Response(null, { status: 500 }));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household and roll back create",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to roll back household after create activation failure",
        expect.any(Error),
      );
      expect(setActiveOrganizationMock).toHaveBeenNthCalledWith(2, {
        asResponse: true,
        body: {
          organizationId: "77",
        },
        headers: expect.any(Headers),
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST restores the sole fallback household when activation rollback runs", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: null },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "fallback",
        household: {
          id: 88,
          name: "Cabin",
          timeZone: "UTC",
          icon: null,
          role: "member",
        },
      });
      createHouseholdWithOwnerMock.mockResolvedValue(107);
      setActiveOrganizationMock.mockRejectedValueOnce(new Error("session update failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
      expect(setActiveOrganizationMock).toHaveBeenNthCalledWith(2, {
        asResponse: true,
        body: {
          organizationId: "88",
        },
        headers: expect.any(Headers),
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to set active household after create",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST does not fail rollback when previous active household is stale", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "21" },
        session: { activeOrganizationId: "77" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "selection-required",
        households: [
          {
            id: 88,
            name: "Cabin",
            timeZone: "UTC",
            icon: null,
            role: "member",
          },
          {
            id: 89,
            name: "Flat",
            timeZone: "UTC",
            icon: null,
            role: "owner",
          },
        ],
      });
      createHouseholdWithOwnerMock.mockResolvedValue(108);
      setActiveOrganizationMock.mockRejectedValueOnce(new Error("session update failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Annex",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
      expect(setActiveOrganizationMock).toHaveBeenCalledTimes(1);
      expect(deleteOrganizationMock).toHaveBeenCalledWith({
        asResponse: true,
        body: {
          organizationId: "108",
        },
        headers: expect.any(Headers),
      });
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        "Failed to roll back household after create activation failure",
        expect.anything(),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("POST rejects invalid time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(
      requestWithBody("POST", {
        name: "The Heap",
        timeZone: "Not/AZone",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST requires a time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(
      requestWithBody("POST", {
        name: "The Heap",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST rejects non-object json payloads", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "21" } });

    const response = await POST(requestWithRawBody("POST", "[]"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_JSON_BODY,
      error: "Invalid JSON body",
    });
    expect(createHouseholdWithOwnerMock).not.toHaveBeenCalled();
  });

  it("POST returns consistent 500 envelope on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({ user: { id: "21" } });
      createHouseholdWithOwnerMock.mockRejectedValue(new Error("insert failed"));

      const response = await POST(
        requestWithBody("POST", {
          name: "The Heap",
          timeZone: "UTC",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to create household",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PATCH rejects non-admin users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "member",
      },
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "New Flat",
        timeZone: "UTC",
        icon: "🏠",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Forbidden",
    });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH updates household and clears empty icon", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: "🏠",
        role: "owner",
      },
    });
    updateHouseholdByIdMock.mockResolvedValue({
      id: 3,
      name: "Flat 2",
      timeZone: "UTC",
      icon: null,
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "  Flat 2  ",
        timeZone: "UTC",
        icon: "   ",
      }),
    );
    const body = await response.json();

    expect(updateHouseholdByIdMock).toHaveBeenCalledWith({
      householdId: 3,
      name: "Flat 2",
      timeZone: "UTC",
      icon: null,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      household: {
        id: 3,
        name: "Flat 2",
        timeZone: "UTC",
        icon: null,
      },
    });
  });

  it("PATCH rejects invalid time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: "🏠",
        role: "owner",
      },
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "Flat 2",
        timeZone: "invalid/zone",
        icon: "🏠",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH requires a time zone", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: "🏠",
        role: "owner",
      },
    });

    const response = await PATCH(
      requestWithBody("PATCH", {
        name: "Flat 2",
        icon: "🏠",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.INVALID_TIME_ZONE,
      error: "Invalid time zone",
    });
    expect(updateHouseholdByIdMock).not.toHaveBeenCalled();
  });

  it("PATCH preserves reconciliation headers on unexpected errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "9" },
        session: { activeOrganizationId: "3" },
      });
      reconcileActiveHouseholdSessionMock.mockResolvedValue(
        new Headers({ "set-cookie": "better-auth.session=healed; Path=/; HttpOnly" }),
      );
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "fallback",
        household: {
          id: 3,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      updateHouseholdByIdMock.mockRejectedValue(new Error("update failed"));

      const response = await PATCH(
        requestWithBody("PATCH", {
          name: "Flat 2",
          timeZone: "UTC",
          icon: "🏠",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to update household",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("DELETE rejects admins who are not owners", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "admin",
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Only owners can delete households",
    });
    expect(deleteOrganizationMock).not.toHaveBeenCalled();
  });

  it("DELETE blocks owners while other active members remain", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });
    householdHasOtherActiveMembersMock.mockResolvedValue(true);

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.HOUSEHOLD_HAS_OTHER_MEMBERS,
      error: "Remove other active members before deleting this household",
    });
    expect(deleteOrganizationMock).not.toHaveBeenCalled();
  });

  it("DELETE removes the household and redirects to setup when none remain", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
    expect(body).toEqual({
      ok: true,
      deletedHouseholdId: 3,
      activeHouseholdActivated: false,
      nextPath: "/household/setup",
    });
    expect(deleteOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "3",
      },
      headers: expect.any(Headers),
    });
    expect(reconcileActiveHouseholdAfterMembershipMutationMock).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      sessionActiveHouseholdId: 3,
      userId: 9,
    });
  });

  it("DELETE activates the only remaining household", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: true,
      nextPath: "/household",
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 7,
          name: "Cabin",
          timeZone: "UTC",
          icon: "🏕",
          role: "member",
        },
      },
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=reactivated; Path=/; HttpOnly",
      }),
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedHouseholdId: 3,
      activeHouseholdActivated: true,
      nextPath: "/household",
    });
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
  });

  it("DELETE returns 500 when Better Auth delete returns non-ok response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "9" },
        session: { activeOrganizationId: "3" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 3,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      deleteOrganizationMock.mockResolvedValue(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=deleted; Path=/; HttpOnly",
          },
        }),
      );

      const response = await DELETE(
        new Request("http://localhost/api/households", { method: "DELETE" }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to delete household",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
      expect(reconcileActiveHouseholdAfterMembershipMutationMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("DELETE sends users to selector when multiple households remain", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household/select",
      resolution: {
        status: "selection-required",
        households: [
          {
            id: 7,
            name: "Cabin",
            timeZone: "UTC",
            icon: "🏕",
            role: "member",
          },
          {
            id: 8,
            name: "Studio",
            timeZone: "Europe/Warsaw",
            icon: null,
            role: "owner",
          },
        ],
      },
      responseHeaders: new Headers(),
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedHouseholdId: 3,
      activeHouseholdActivated: false,
      nextPath: "/household/select",
    });
  });

  it("DELETE still returns success if remaining-households lookup fails after delete", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getSessionMock.mockResolvedValue({
        user: { id: "9" },
        session: { activeOrganizationId: "3" },
      });
      resolveActiveHouseholdMock.mockResolvedValue({
        status: "resolved",
        source: "session",
        household: {
          id: 3,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      });
      reconcileActiveHouseholdAfterMembershipMutationMock.mockRejectedValue(
        new Error("db failed after delete"),
      );

      const response = await DELETE(
        new Request("http://localhost/api/households", { method: "DELETE" }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=deleted");
      expect(body).toEqual({
        ok: true,
        deletedHouseholdId: 3,
        activeHouseholdActivated: false,
        nextPath: "/household/select",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to inspect remaining households after delete",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("DELETE still returns household path when sole-remaining household activation fails", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "9" }, session: { activeOrganizationId: "3" } });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household",
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 7,
          name: "Cabin",
          timeZone: "UTC",
          icon: "🏕",
          role: "member",
        },
      },
      responseHeaders: new Headers(),
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedHouseholdId: 3,
      activeHouseholdActivated: false,
      nextPath: "/household",
    });
  });

  it("DELETE keeps household fallback path when activation returns non-ok response", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "9" },
      session: { activeOrganizationId: "3" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 3,
        name: "Flat",
        timeZone: "UTC",
        icon: null,
        role: "owner",
      },
    });
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household",
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 7,
          name: "Cabin",
          timeZone: "UTC",
          icon: "🏕",
          role: "member",
        },
      },
      responseHeaders: new Headers(),
    });

    const response = await DELETE(
      new Request("http://localhost/api/households", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedHouseholdId: 3,
      activeHouseholdActivated: false,
      nextPath: "/household",
    });
  });

  it("GET returns selection required when multiple households exist without an active choice", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "7" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [],
    });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.HOUSEHOLD_SELECTION_REQUIRED,
      error: "Active household selection required",
    });
  });
});
