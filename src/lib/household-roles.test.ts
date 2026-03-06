import { describe, expect, it } from "vitest";

import {
  isHouseholdElevatedRole,
  isHouseholdRole,
  normalizeHouseholdRole,
} from "@/lib/household-roles";

describe("household role helpers", () => {
  it("recognizes supported roles", () => {
    expect(isHouseholdRole("owner")).toBe(true);
    expect(isHouseholdRole("admin")).toBe(true);
    expect(isHouseholdRole("member")).toBe(true);
    expect(isHouseholdRole("unknown")).toBe(false);
  });

  it("normalizes unknown roles to member", () => {
    expect(normalizeHouseholdRole("owner")).toBe("owner");
    expect(normalizeHouseholdRole("admin")).toBe("admin");
    expect(normalizeHouseholdRole("member")).toBe("member");
    expect(normalizeHouseholdRole("custom")).toBe("member");
  });

  it("treats owner and admin as elevated", () => {
    expect(isHouseholdElevatedRole("owner")).toBe(true);
    expect(isHouseholdElevatedRole("admin")).toBe(true);
    expect(isHouseholdElevatedRole("member")).toBe(false);
  });
});
