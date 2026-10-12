import { describe, expect, it } from "vitest";
import { isPendingInviteUniqueConflict } from "@/lib/household-invite-policy";

describe("pending invitation uniqueness failures", () => {
  it("recognizes exact index violations through adapter wrappers", () => {
    expect(
      isPendingInviteUniqueConflict({
        body: {
          cause: { code: "23505", constraint: "household_member_invites_pending_email_unique" },
        },
      }),
    ).toBe(true);
  });
  it("does not treat unrelated database errors as invitation conflicts", () => {
    expect(isPendingInviteUniqueConflict({ code: "23505", constraint: "users_email_unique" })).toBe(
      false,
    );
    expect(isPendingInviteUniqueConflict({ code: "23503" })).toBe(false);
  });
  it("safely handles cyclic error causes", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(isPendingInviteUniqueConflict(error)).toBe(false);
  });
});
