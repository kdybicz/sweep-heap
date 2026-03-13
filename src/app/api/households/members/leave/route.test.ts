import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const {
  leaveOrganizationMock,
  reconcileActiveHouseholdAfterMembershipMutationMock,
  requireApiHouseholdMock,
  withHouseholdMutationLockMock,
} = vi.hoisted(() => ({
  leaveOrganizationMock: vi.fn(),
  reconcileActiveHouseholdAfterMembershipMutationMock: vi.fn(),
  requireApiHouseholdMock: vi.fn(),
  withHouseholdMutationLockMock: vi.fn(async ({ task }: { task: () => Promise<unknown> }) =>
    task(),
  ),
}));

vi.mock("@/auth", () => ({
  auth: {
    api: {
      leaveOrganization: leaveOrganizationMock,
    },
  },
}));

vi.mock("@/lib/api-access", () => ({
  requireApiHousehold: requireApiHouseholdMock,
}));

vi.mock("@/lib/services", () => ({
  reconcileActiveHouseholdAfterMembershipMutation:
    reconcileActiveHouseholdAfterMembershipMutationMock,
  withHouseholdMutationLock: withHouseholdMutationLockMock,
}));

import { POST } from "@/app/api/households/members/leave/route";

describe("/api/households/members/leave route", () => {
  beforeEach(() => {
    leaveOrganizationMock.mockReset();
    reconcileActiveHouseholdAfterMembershipMutationMock.mockReset();
    requireApiHouseholdMock.mockReset();
    withHouseholdMutationLockMock.mockClear();

    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=healed; Path=/; HttpOnly",
      }),
      household: { id: 11, name: "Home", role: "member" },
      sessionContext: {
        sessionActiveHouseholdId: 11,
        userId: 7,
      },
    });
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household/setup",
      resolution: { status: "none" },
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=left; Path=/; HttpOnly",
      }),
    });
    leaveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "set-cookie": "better-auth.session=leave-org; Path=/; HttpOnly",
        },
      }),
    );
  });

  it("allows a non-owner to leave and reconciles active household state", async () => {
    leaveOrganizationMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "content-type": "text/plain",
          "set-cookie": "better-auth.session=leave-org; Path=/; HttpOnly",
        },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/households/members/leave", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      activeHouseholdActivated: false,
      leftHouseholdId: 11,
      nextPath: "/household/setup",
    });
    expect(withHouseholdMutationLockMock).toHaveBeenCalledWith({
      householdId: 11,
      task: expect.any(Function),
    });
    expect(leaveOrganizationMock).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        organizationId: "11",
      },
      headers: expect.any(Headers),
    });
    expect(reconcileActiveHouseholdAfterMembershipMutationMock).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      sessionActiveHouseholdId: 11,
      userId: 7,
    });
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
    expect(response.headers.get("set-cookie")).toContain("better-auth.session=leave-org");
  });

  it("blocks owners until they transfer ownership", async () => {
    requireApiHouseholdMock.mockResolvedValue({
      ok: true,
      responseHeaders: new Headers(),
      household: { id: 11, name: "Home", role: "owner" },
      sessionContext: {
        sessionActiveHouseholdId: 11,
        userId: 7,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/households/members/leave", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.FORBIDDEN,
      error: "Transfer ownership before leaving this household",
    });
    expect(leaveOrganizationMock).not.toHaveBeenCalled();
  });

  it("maps last-owner conflicts from membership removal", async () => {
    leaveOrganizationMock.mockRejectedValue({
      body: {
        code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
        message: "You cannot leave the organization as the only owner",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/households/members/leave", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: API_ERROR_CODE.LAST_OWNER_REQUIRED,
      error: "At least one household owner must remain",
    });
  });

  it("returns 500 when leaveOrganization responds non-ok", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      leaveOrganizationMock.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          headers: {
            "set-cookie": "better-auth.session=leave-org; Path=/; HttpOnly",
          },
        }),
      );

      const response = await POST(
        new Request("http://localhost/api/households/members/leave", {
          method: "POST",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to leave household",
      });
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=healed");
      expect(response.headers.get("set-cookie")).toContain("better-auth.session=leave-org");
      expect(reconcileActiveHouseholdAfterMembershipMutationMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to leave household", expect.any(Error));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns selection redirect details when another household must be chosen", async () => {
    reconcileActiveHouseholdAfterMembershipMutationMock.mockResolvedValue({
      activeHouseholdActivated: false,
      nextPath: "/household/select",
      resolution: {
        status: "selection-required",
        households: [
          { id: 12, name: "Cabin", timeZone: "UTC", icon: null, role: "member" },
          { id: 13, name: "Flat", timeZone: "UTC", icon: null, role: "admin" },
        ],
      },
      responseHeaders: new Headers({
        "set-cookie": "better-auth.session=cleared; Path=/; HttpOnly",
      }),
    });

    const response = await POST(
      new Request("http://localhost/api/households/members/leave", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      activeHouseholdActivated: false,
      leftHouseholdId: 11,
      nextPath: "/household/select",
    });
  });

  it("still returns success when post-leave reconciliation fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reconcileActiveHouseholdAfterMembershipMutationMock.mockRejectedValueOnce(
        new Error("lookup failed after leave"),
      );

      const response = await POST(
        new Request("http://localhost/api/households/members/leave", {
          method: "POST",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        activeHouseholdActivated: false,
        leftHouseholdId: 11,
        nextPath: "/household/select",
      });
      expect(leaveOrganizationMock).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to reconcile active household after leave",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
