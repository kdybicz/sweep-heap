import { afterEach, describe, expect, it, vi } from "vitest";

const originalSupportedValuesOf = Intl.supportedValuesOf;

const setSupportedValuesOf = (value: typeof Intl.supportedValuesOf | undefined) => {
  Object.defineProperty(Intl, "supportedValuesOf", {
    value,
    configurable: true,
    writable: true,
  });
};

describe("householdTimeZones", () => {
  afterEach(() => {
    vi.resetModules();
    setSupportedValuesOf(originalSupportedValuesOf);
  });

  it("uses fallback list when Intl.supportedValuesOf is unavailable", async () => {
    setSupportedValuesOf(undefined);

    const { householdTimeZones } = await import("@/lib/time-zones");

    expect(householdTimeZones).toEqual([
      "UTC",
      "Europe/London",
      "Europe/Warsaw",
      "Europe/Paris",
      "Europe/Berlin",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Sao_Paulo",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Asia/Singapore",
      "Australia/Sydney",
    ]);
  });

  it("uses supported time zones with UTC first", async () => {
    setSupportedValuesOf(() => ["Europe/Paris", "UTC", "America/Chicago"]);

    const { householdTimeZones } = await import("@/lib/time-zones");

    expect(householdTimeZones).toEqual(["UTC", "America/Chicago", "Europe/Paris"]);
  });
});
