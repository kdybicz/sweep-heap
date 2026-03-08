import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, getActiveHouseholdSummaryMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getActiveHouseholdSummaryMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/repositories", () => ({
  getActiveHouseholdSummary: getActiveHouseholdSummaryMock,
  getUserMemberships: vi.fn(),
}));

import { redirectSignedInUserToApp, requirePageActiveHousehold } from "@/lib/page-access";

describe("requirePageActiveHousehold", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getActiveHouseholdSummaryMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects signed-in users without a household to setup", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue(null);

    await expect(requirePageActiveHousehold()).rejects.toThrow("REDIRECT:/household/setup");
    expect(redirectMock).toHaveBeenCalledWith("/household/setup");
  });

  it("returns session and household data when onboarding is complete", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 7,
      name: "Home",
      role: "owner",
      timeZone: "Europe/Warsaw",
    });

    await expect(requirePageActiveHousehold()).resolves.toEqual({
      sessionUserId: "12",
      sessionUserName: "Alex",
      sessionUserEmail: "alex@example.com",
      userId: 12,
      household: {
        id: 7,
        name: "Home",
        role: "owner",
        timeZone: "Europe/Warsaw",
      },
    });
  });
});

describe("redirectSignedInUserToApp", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getActiveHouseholdSummaryMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects signed-in users without a household to setup", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue(null);

    await expect(redirectSignedInUserToApp()).rejects.toThrow("REDIRECT:/household/setup");
    expect(redirectMock).toHaveBeenCalledWith("/household/setup");
  });

  it("redirects signed-in users with a household to the board", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
    });
    getActiveHouseholdSummaryMock.mockResolvedValue({
      id: 7,
      name: "Home",
      role: "owner",
      timeZone: "Europe/Warsaw",
    });

    await expect(redirectSignedInUserToApp()).rejects.toThrow("REDIRECT:/household");
    expect(redirectMock).toHaveBeenCalledWith("/household");
  });

  it("does nothing for signed-out visitors", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(redirectSignedInUserToApp()).resolves.toBeUndefined();
    expect(getActiveHouseholdSummaryMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
