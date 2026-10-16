import { describe, expect, it } from "vitest";
import { validateChorePatchPayload } from "@/lib/api-payload-validation";

describe("chore payload date boundary", () => {
  it.each([
    [{ action: "create", startDate: "2026-02-30" }, "startDate"],
    [{ action: "edit", scope: "single", endDate: null }, "endDate"],
    [{ action: "edit", scope: "following", seriesEndDate: "bad" }, "repeatEnd"],
    [{ action: "edit", scope: "all", startDate: 42 }, "startDate"],
    [{ action: "set", status: "closed", occurrenceStartDate: "0000-01-01" }, "occurrenceStartDate"],
    [{ action: "cancel", scope: "all", occurrenceStartDate: "2026-02-30" }, "occurrenceStartDate"],
  ])("rejects consumed invalid date fields before mutation", (payload, field) => {
    const result = validateChorePatchPayload(payload);
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
      error: "Validation failed",
      fieldErrors: { [field]: expect.any(String) },
    });
  });
  it("preserves timestamp text for later household normalization and allows omitted edit dates", () => {
    const payload = {
      action: "edit",
      scope: "all",
      startDate: "2026-01-01T23:30:00Z",
      seriesEndDate: null,
    };
    expect(validateChorePatchPayload(payload)).toEqual({ ok: true, data: payload });
    expect(
      validateChorePatchPayload({ action: "edit", scope: "all", title: "Notes only" }).ok,
    ).toBe(true);
  });
  it("retains intent-error precedence", () => {
    expect(validateChorePatchPayload({ action: "bad", startDate: "2026-02-30" })).toMatchObject({
      ok: false,
      code: "ACTION_INVALID",
    });
  });
});
