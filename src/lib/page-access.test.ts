import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  listActiveHouseholdsForUserMock,
  resolveActiveHouseholdMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  listActiveHouseholdsForUserMock: vi.fn(),
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

vi.mock("@/lib/services/active-household-service", () => ({
  resolveActiveHousehold: resolveActiveHouseholdMock,
}));

vi.mock("@/lib/repositories", () => ({
  listActiveHouseholdsForUser: listActiveHouseholdsForUserMock,
}));

import {
  redirectSignedInUserToApp,
  requirePageActiveHousehold,
  requirePageHouseholdSelection,
} from "@/lib/page-access";

describe("requirePageActiveHousehold", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
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
    listActiveHouseholdsForUserMock.mockReset();
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

describe("requirePageHouseholdSelection", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listActiveHouseholdsForUserMock.mockReset();
    resolveActiveHouseholdMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects to setup when the user has no households", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({ status: "none" });

    await expect(requirePageHouseholdSelection()).rejects.toThrow("REDIRECT:/household/setup");
    expect(redirectMock).toHaveBeenCalledWith("/household/setup");
  });

  it("returns selection households when a choice is required", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: null },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "selection-required",
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });

    await expect(requirePageHouseholdSelection()).resolves.toEqual({
      sessionActiveHouseholdId: null,
      sessionUserId: "12",
      sessionUserName: "Alex",
      sessionUserEmail: "alex@example.com",
      userId: 12,
      householdResolution: {
        status: "selection-required",
        households: [
          { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
          { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
        ],
      },
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });
    expect(listActiveHouseholdsForUserMock).not.toHaveBeenCalled();
  });

  it("loads switcher households for users who already have an active selection", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: "7" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
    });
    listActiveHouseholdsForUserMock.mockResolvedValue([
      { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
      { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
    ]);

    await expect(requirePageHouseholdSelection()).resolves.toEqual({
      sessionActiveHouseholdId: 7,
      sessionUserId: "12",
      sessionUserName: "Alex",
      sessionUserEmail: "alex@example.com",
      userId: 12,
      householdResolution: {
        status: "resolved",
        source: "session",
        household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
      },
      households: [
        { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
        { id: 8, name: "Cabin", role: "member", timeZone: "UTC" },
      ],
    });
    expect(listActiveHouseholdsForUserMock).toHaveBeenCalledWith(12);
  });

  it("redirects back to the board when only one household remains selectable", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "12", email: "alex@example.com", name: "Alex" },
      session: { activeOrganizationId: "7" },
    });
    resolveActiveHouseholdMock.mockResolvedValue({
      status: "resolved",
      source: "session",
      household: { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
    });
    listActiveHouseholdsForUserMock.mockResolvedValue([
      { id: 7, name: "Home", role: "owner", timeZone: "UTC" },
    ]);

    await expect(requirePageHouseholdSelection()).rejects.toThrow("REDIRECT:/household");
    expect(redirectMock).toHaveBeenCalledWith("/household");
  });
});
