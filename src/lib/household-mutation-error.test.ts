import { describe, expect, it } from "vitest";
import { householdMutationBusyResponse } from "@/lib/api-error";
import { HouseholdMutationBusyError } from "@/lib/household-mutation-error";

describe("busy household response", () => {
  it("returns a retryable conflict and preserves reconciliation cookies", async () => {
    const response = householdMutationBusyResponse(new HouseholdMutationBusyError(), {
      "set-cookie": "session=healed",
    });
    expect(response?.status).toBe(409);
    expect(response?.headers.get("set-cookie")).toBe("session=healed");
    expect(await response?.json()).toEqual({
      ok: false,
      code: "HOUSEHOLD_MUTATION_BUSY",
      error: "Household is busy. Please retry.",
    });
  });
  it("does not classify unrelated errors as lock conflicts", () => {
    expect(householdMutationBusyResponse(new Error("database unavailable"))).toBeNull();
  });
});
