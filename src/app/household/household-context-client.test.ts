import { describe, expect, it, vi } from "vitest";

import {
  getHouseholdContextRedirectError,
  getHouseholdContextRedirectPath,
  HouseholdContextRedirectError,
  readApiJsonResponse,
  recoverFromHouseholdContextError,
} from "@/app/household/household-context-client";

describe("household context client helpers", () => {
  it("maps missing household access states to redirect paths", () => {
    expect(getHouseholdContextRedirectPath("UNAUTHORIZED")).toBe("/auth");
    expect(getHouseholdContextRedirectPath("HOUSEHOLD_REQUIRED")).toBe("/household/setup");
    expect(getHouseholdContextRedirectPath("HOUSEHOLD_SELECTION_REQUIRED")).toBe(
      "/household/select",
    );
    expect(getHouseholdContextRedirectPath("HOUSEHOLD_NOT_FOUND")).toBe("/household/select");
    expect(getHouseholdContextRedirectPath("FORBIDDEN")).toBeNull();
  });

  it("creates redirect errors from household context API responses", () => {
    const error = getHouseholdContextRedirectError({
      ok: false,
      code: "HOUSEHOLD_NOT_FOUND",
      error: "Household not found",
    });

    expect(error).toBeInstanceOf(HouseholdContextRedirectError);
    expect(error?.redirectPath).toBe("/household/select");
    expect(error?.message).toBe("Household not found");
  });

  it("ignores household context codes on successful payloads", () => {
    expect(
      getHouseholdContextRedirectError({
        ok: true,
        code: "HOUSEHOLD_NOT_FOUND",
        error: "debug metadata only",
      }),
    ).toBeNull();
  });

  it("parses JSON responses only when content type is json", async () => {
    await expect(
      readApiJsonResponse<{ ok: boolean }>({
        headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
        json: vi.fn().mockResolvedValue({ ok: false }),
      }),
    ).resolves.toEqual({ ok: false });

    await expect(
      readApiJsonResponse({
        headers: new Headers({ "content-type": "text/html" }),
        json: vi.fn(),
      }),
    ).resolves.toBeNull();
  });

  it("redirects browser when recovery is possible", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign: assignMock,
      },
    });

    try {
      expect(
        recoverFromHouseholdContextError({
          ok: false,
          code: "HOUSEHOLD_SELECTION_REQUIRED",
          error: "Active household selection required",
        }),
      ).toBe(true);
      expect(assignMock).toHaveBeenCalledWith("/household/select");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("redirects browser to auth when session recovery is required", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign: assignMock,
      },
    });

    try {
      expect(
        recoverFromHouseholdContextError({
          ok: false,
          code: "UNAUTHORIZED",
          error: "Unauthorized",
        }),
      ).toBe(true);
      expect(assignMock).toHaveBeenCalledWith("/auth");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does nothing for unrelated API errors", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign: assignMock,
      },
    });

    try {
      expect(
        recoverFromHouseholdContextError({
          ok: false,
          code: "FORBIDDEN",
          error: "Forbidden",
        }),
      ).toBe(false);
      expect(assignMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
