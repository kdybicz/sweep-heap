import { describe, expect, it } from "vitest";
import {
  type HouseholdPendingInvite,
  mergePendingInvite,
} from "@/app/household/members/members-view-utils";

const invite = (id: number, email: string, expired?: boolean): HouseholdPendingInvite => ({
  id,
  email,
  expired,
  role: "member",
  createdAt: "2026-01-01",
  expiresAt: "2126-01-08",
});
describe("pending invitation state reconciliation", () => {
  it("removes a retired expired id when the normalized email gets a replacement", () => {
    const replacement = invite(20, "friend@example.com");
    const rows = mergePendingInvite(
      [invite(10, " Friend@Example.com ", true), invite(11, "other@example.com")],
      replacement,
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === 10)).toBeUndefined();
    expect(rows.find((row) => row.id === 20)).toBe(replacement);
    expect(rows.find((row) => row.id === 11)).toBeDefined();
  });
  it("refreshes an existing id without retaining its old expired flag", () => {
    const active = invite(10, "friend@example.com");
    expect(mergePendingInvite([invite(10, "friend@example.com", true)], active)).toEqual([active]);
  });
});
