import { describe, expect, it, vi } from "vitest";

import { API_ERROR_CODE } from "@/lib/api-error";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

import { parseSessionContext } from "@/lib/session-context";

const asSession = (session: unknown) => session as Awaited<ReturnType<typeof getSessionMock>>;

describe("parseSessionContext", () => {
  it("accepts positive integer user ids", () => {
    expect(
      parseSessionContext(
        asSession({
          user: {
            id: "12",
            name: "Alex",
            email: "alex@example.com",
          },
          session: {
            activeOrganizationId: "7",
          },
        }),
      ),
    ).toEqual({
      ok: true,
      sessionActiveHouseholdId: 7,
      userId: 12,
      sessionUserId: "12",
      sessionUserName: "Alex",
      sessionUserEmail: "alex@example.com",
    });
  });

  it.each(["0", "-1", "12.5"])("rejects non-positive integer user id %s", (userId) => {
    expect(
      parseSessionContext(
        asSession({
          user: {
            id: userId,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      userId: null,
      status: 400,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    });
  });

  it("coerces invalid active household ids to null", () => {
    expect(
      parseSessionContext(
        asSession({
          user: {
            id: "12",
          },
          session: {
            activeOrganizationId: "7.5",
          },
        }),
      ),
    ).toMatchObject({
      ok: true,
      sessionActiveHouseholdId: null,
      userId: 12,
    });
  });
});
