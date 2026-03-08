import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, resolveActiveHouseholdMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  resolveActiveHouseholdMock: vi.fn(),
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

vi.mock("@/lib/services", () => ({
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

import { redirectSignedInUserToApp, requirePageActiveHousehold } from "@/lib/page-access";

describe("requirePageActiveHousehold", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects signed-in users without a household to setup", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });

    await expect(requirePageActiveHousehold()).rejects.toThrow("REDIRECT:/household/setup");
    expect(redirectMock).toHaveBeenCalledWith("/household/setup");
  });

  it("redirects to selector when multiple households exist without an active one", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [],
    });

    await expect(requirePageActiveHousehold()).rejects.toThrow("REDIRECT:/household/select");
    expect(redirectMock).toHaveBeenCalledWith("/household/select");
  });

  it("returns session and household data when onboarding is complete", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: "7" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 7,
        name: "Home",
        role: "owner",
        timeZone: "Europe/Warsaw",
      },
    });

    await expect(requirePageActiveHousehold()).resolves.toEqual({
      sessionActiveHouseholdId: 7,
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
    resolveActiveHouseholdMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects signed-in users without a household to setup", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });

    await expect(redirectSignedInUserToApp()).rejects.toThrow("REDIRECT:/household/setup");
    expect(redirectMock).toHaveBeenCalledWith("/household/setup");
  });

  it("redirects signed-in users with a household to the board", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: "7" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: {
        id: 7,
        name: "Home",
        role: "owner",
        timeZone: "Europe/Warsaw",
      },
    });

    await expect(redirectSignedInUserToApp()).rejects.toThrow("REDIRECT:/household");
    expect(redirectMock).toHaveBeenCalledWith("/household");
  });

  it("redirects users who must choose a household to the selector", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [],
    });

    await expect(redirectSignedInUserToApp()).rejects.toThrow("REDIRECT:/household/select");
    expect(redirectMock).toHaveBeenCalledWith("/household/select");
  });

  it("does nothing for signed-out visitors", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(redirectSignedInUserToApp()).resolves.toBeUndefined();
    expect(resolveActiveHouseholdMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
