import { describe, expect, it, vi } from "vitest";

const { getFullOrganization } = vi.hoisted(() => ({ getFullOrganization: vi.fn() }));
vi.mock("@/auth", () => ({ auth: { api: { getFullOrganization } } }));

import { getHouseholdMembersSnapshot } from "@/lib/household-members";

describe("invitation recovery visibility", () => {
  it("keeps expired pending invitations visible and excludes terminal rows", async () => {
    getFullOrganization.mockResolvedValue({
      members: [],
      invitations: [
        {
          id: 1,
          email: "expired@example.com",
          role: "member",
          status: "pending",
          createdAt: "2025-01-01",
          expiresAt: "2025-01-08",
        },
        {
          id: 2,
          email: "active@example.com",
          role: "member",
          status: "pending",
          createdAt: "2025-01-01",
          expiresAt: "2126-01-08",
        },
        {
          id: 3,
          email: "canceled@example.com",
          role: "member",
          status: "canceled",
          createdAt: "2025-01-01",
          expiresAt: "2126-01-08",
        },
      ],
    });
    const snapshot = await getHouseholdMembersSnapshot({
      householdId: 11,
      requestHeaders: new Headers(),
    });
    expect(snapshot.pendingInvites).toHaveLength(2);
    expect(snapshot.pendingInvites[0]).toMatchObject({ id: 1, expired: true });
    expect(snapshot.pendingInvites[1]).not.toHaveProperty("expired");
  });
});
