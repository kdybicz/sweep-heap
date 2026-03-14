import { describe, expect, it } from "vitest";

import { getSafeCallbackUrl } from "@/app/auth/AuthForm";

describe("getSafeCallbackUrl", () => {
  it("falls back to the auth entry point for empty values", () => {
    expect(getSafeCallbackUrl("")).toBe("/auth");
  });

  it("keeps relative in-app callbacks", () => {
    expect(
      getSafeCallbackUrl("/api/households/invites/complete?invitationId=12&secret=s3cr3t"),
    ).toBe("/api/households/invites/complete?invitationId=12&secret=s3cr3t");
  });

  it("rejects external callback urls", () => {
    expect(getSafeCallbackUrl("https://example.com/evil")).toBe("/auth");
    expect(getSafeCallbackUrl("//example.com/evil")).toBe("/auth");
    expect(getSafeCallbackUrl("/%5Cevil.com")).toBe("/auth");
    expect(getSafeCallbackUrl("/\\evil.com")).toBe("/auth");
  });
});
