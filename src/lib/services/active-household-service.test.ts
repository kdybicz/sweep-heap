import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getHouseholdSummaryForUserMock,
  listActiveHouseholdsForUserMock,
  setActiveOrganizationMock,
} = vi.hoisted(() => ({
  getHouseholdSummaryForUserMock: vi.fn(),
  listActiveHouseholdsForUserMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
}));

vi.mock("@/lib/repositories", () => ({
  getHouseholdSummaryForUser: getHouseholdSummaryForUserMock,
  listActiveHouseholdsForUser: listActiveHouseholdsForUserMock,
}));

import {
  reconcileActiveHouseholdAfterMembershipMutation,
  reconcileActiveHouseholdSession,
  resolveActiveHousehold,
} from "@/lib/services/active-household-service";

describe("resolveActiveHousehold", () => {
  beforeEach(() => {
    getHouseholdSummaryForUserMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
    setActiveOrganizationMock.mockReset();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("uses the session active household when membership is valid", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue({
      id: 12,
      name: "Home",
      timeZone: "UTC",
      icon: "🏡",
      role: "admin",
    });

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: 12,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "resolved",
      household: {
        id: 12,
        name: "Home",
        timeZone: "UTC",
        icon: "🏡",
        role: "admin",
      },
      source: "session",
    });
    expect(listActiveHouseholdsForUserMock).not.toHaveBeenCalled();
  });

  it("falls back to the only active household when session context is unset", async () => {
    listActiveHouseholdsForUserMock.mockResolvedValue([
      {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
    ]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: null,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "resolved",
      household: {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
      source: "fallback",
    });
  });

  it("returns none when the user has no active households", async () => {
    listActiveHouseholdsForUserMock.mockResolvedValue([]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: null,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "none",
    });
  });

  it("requires explicit selection when multiple households are available", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue(null);
    listActiveHouseholdsForUserMock.mockResolvedValue([
      {
        id: 9,
        name: "Flat",
        timeZone: "Europe/Warsaw",
        icon: null,
        role: "owner",
      },
      {
        id: 12,
        name: "Cabin",
        timeZone: "UTC",
        icon: "🏕",
        role: "member",
      },
    ]);

    await expect(
      resolveActiveHousehold({
        sessionActiveHouseholdId: 7,
        userId: 7,
      }),
    ).resolves.toEqual({
      status: "selection-required",
      households: [
        {
          id: 9,
          name: "Flat",
          timeZone: "Europe/Warsaw",
          icon: null,
          role: "owner",
        },
        {
          id: 12,
          name: "Cabin",
          timeZone: "UTC",
          icon: "🏕",
          role: "member",
        },
      ],
    });
  });
});

describe("reconcileActiveHouseholdSession", () => {
  beforeEach(() => {
    setActiveOrganizationMock.mockClear();
  });

  it("activates the sole fallback household in session", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 9,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      },
      sessionActiveHouseholdId: null,
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "9",
      },
      headers: expect.any(Headers),
    });
    expect(headers.get("set-cookie")).toContain("better-auth.session=updated");
  });

  it("clears stale session selection when no household remains", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "none",
      },
      sessionActiveHouseholdId: 9,
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: null,
      },
      headers: expect.any(Headers),
    });
    expect(headers.get("set-cookie")).toContain("better-auth.session=updated");
  });

  it("throws when fallback activation returns a non-ok response", async () => {
    setActiveOrganizationMock.mockResolvedValueOnce(
      new Response(null, {
        status: 500,
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );

    await expect(
      reconcileActiveHouseholdSession({
        requestHeaders: new Headers(),
        resolution: {
          status: "resolved",
          source: "fallback",
          household: {
            id: 9,
            name: "Flat",
            timeZone: "UTC",
            icon: null,
            role: "owner",
          },
        },
        sessionActiveHouseholdId: null,
      }),
    ).rejects.toThrow("Activate fallback household failed (status 500)");
  });

  it("throws when stale-session clear returns a non-ok response", async () => {
    setActiveOrganizationMock.mockResolvedValueOnce(
      new Response(null, {
        status: 500,
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );

    await expect(
      reconcileActiveHouseholdSession({
        requestHeaders: new Headers(),
        resolution: {
          status: "none",
        },
        sessionActiveHouseholdId: 9,
      }),
    ).rejects.toThrow("Clear stale active household failed (status 500)");
  });

  it("does not mutate session when selection is already valid", async () => {
    const headers = await reconcileActiveHouseholdSession({
      requestHeaders: new Headers(),
      resolution: {
        status: "resolved",
        source: "session",
        household: {
          id: 9,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "owner",
        },
      },
      sessionActiveHouseholdId: 9,
    });

    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    expect(headers.get("set-cookie")).toBeNull();
  });
});

describe("reconcileActiveHouseholdAfterMembershipMutation", () => {
  beforeEach(() => {
    getHouseholdSummaryForUserMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
    setActiveOrganizationMock.mockReset();

    setActiveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("activates the remaining household and returns the board path", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue(null);
    listActiveHouseholdsForUserMock.mockResolvedValue([
      {
        id: 12,
        name: "Cabin",
        timeZone: "UTC",
        icon: null,
        role: "member",
      },
    ]);

    await expect(
      reconcileActiveHouseholdAfterMembershipMutation({
        requestHeaders: new Headers(),
        sessionActiveHouseholdId: 9,
        userId: 7,
      }),
    ).resolves.toMatchObject({
      activeHouseholdActivated: true,
      nextPath: "/household",
      resolution: {
        status: "resolved",
        source: "fallback",
        household: {
          id: 12,
        },
      },
    });
  });

  it("clears stale selection and sends the user to setup when no households remain", async () => {
    getHouseholdSummaryForUserMock.mockResolvedValue(null);
    listActiveHouseholdsForUserMock.mockResolvedValue([]);

    await expect(
      reconcileActiveHouseholdAfterMembershipMutation({
        requestHeaders: new Headers(),
        sessionActiveHouseholdId: 9,
        userId: 7,
      }),
    ).resolves.toMatchObject({
      activeHouseholdActivated: false,
      nextPath: "/household/setup",
      resolution: {
        status: "none",
      },
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: null,
      },
      headers: expect.any(Headers),
    });
  });

  it("recovers when session reconciliation throws and still returns selection path", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getHouseholdSummaryForUserMock.mockResolvedValue(null);
      listActiveHouseholdsForUserMock.mockResolvedValue([
        {
          id: 12,
          name: "Cabin",
          timeZone: "UTC",
          icon: null,
          role: "member",
        },
        {
          id: 13,
          name: "Flat",
          timeZone: "UTC",
          icon: null,
          role: "admin",
        },
      ]);
      setActiveOrganizationMock.mockRejectedValueOnce(new Error("reconcile failed"));

      await expect(
        reconcileActiveHouseholdAfterMembershipMutation({
          requestHeaders: new Headers(),
          sessionActiveHouseholdId: 9,
          userId: 7,
        }),
      ).resolves.toMatchObject({
        activeHouseholdActivated: false,
        nextPath: "/household/select",
        responseHeaders: expect.any(Headers),
        resolution: {
          status: "selection-required",
        },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household after membership mutation",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("does not report activation when fallback activation returns a non-ok response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getHouseholdSummaryForUserMock.mockResolvedValue(null);
      listActiveHouseholdsForUserMock.mockResolvedValue([
        {
          id: 12,
          name: "Cabin",
          timeZone: "UTC",
          icon: null,
          role: "member",
        },
      ]);
      setActiveOrganizationMock.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=updated; Path=/; HttpOnly",
          },
        }),
      );

      const result = await reconcileActiveHouseholdAfterMembershipMutation({
        requestHeaders: new Headers(),
        sessionActiveHouseholdId: 9,
        userId: 7,
      });

      expect(result).toMatchObject({
        activeHouseholdActivated: false,
        nextPath: "/household",
        resolution: {
          status: "resolved",
          source: "fallback",
        },
      });

      expect(result.responseHeaders.get("set-cookie")).toContain("better-auth.session=updated");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household after membership mutation",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("preserves stale-clear cookies when clear returns a non-ok response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getHouseholdSummaryForUserMock.mockResolvedValue(null);
      listActiveHouseholdsForUserMock.mockResolvedValue([]);
      setActiveOrganizationMock.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=cleared; Path=/; HttpOnly",
          },
        }),
      );

      const result = await reconcileActiveHouseholdAfterMembershipMutation({
        requestHeaders: new Headers(),
        sessionActiveHouseholdId: 9,
        userId: 7,
      });

      expect(result).toMatchObject({
        activeHouseholdActivated: false,
        nextPath: "/household/setup",
        resolution: {
          status: "none",
        },
      });
      expect(result.responseHeaders.get("set-cookie")).toContain("better-auth.session=cleared");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household after membership mutation",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
