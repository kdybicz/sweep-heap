import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHouseholdMemberInvite,
  leaveHouseholdRequest,
  removeHouseholdMemberRequest,
  resendHouseholdMemberInvite,
  revokeHouseholdMemberInvite,
  toMember,
  toPendingInvite,
  transferHouseholdOwnershipRequest,
  updateHouseholdMemberRoleRequest,
} from "@/app/household/members/household-members-client";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

describe("household members client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps API invites and members into normalized view models", () => {
    expect(
      toPendingInvite({
        id: "19",
        email: "friend@example.com",
        role: "owner",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-08T00:00:00.000Z",
      }),
    ).toEqual({
      id: 19,
      email: "friend@example.com",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-08T00:00:00.000Z",
    });

    expect(
      toMember({
        userId: "7",
        name: undefined,
        email: "member@example.com",
        role: "unexpected-role",
        joinedAt: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({
      userId: 7,
      name: null,
      email: "member@example.com",
      role: "member",
      joinedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("sends JSON bodies for member create/update/delete mutations", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));

    await createHouseholdMemberInvite("friend@example.com");
    await updateHouseholdMemberRoleRequest({ userId: 7, role: "admin" });
    await removeHouseholdMemberRequest(9);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/households/members",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "friend@example.com" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/households/members",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 7, role: "admin" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/households/members",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 9 }),
      }),
    );
  });

  it("targets invite and ownership endpoints without adding request bodies unnecessarily", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));

    await resendHouseholdMemberInvite(12);
    await revokeHouseholdMemberInvite(12);
    await transferHouseholdOwnershipRequest(4);
    await leaveHouseholdRequest();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/households/members/invites/12",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/households/members/invites/12",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/households/members/owner-transfer",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 4 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/households/members/leave",
      expect.objectContaining({ method: "POST" }),
    );
    expect((fetchMock.mock.calls[3] ?? [])[1]).not.toHaveProperty("body");
  });

  it("returns parsed JSON payloads from request helpers", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, invite: { id: 5, email: "friend@example.com" } }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, nextPath: "/household/select" }));

    await expect(createHouseholdMemberInvite("friend@example.com")).resolves.toEqual({
      ok: true,
      invite: { id: 5, email: "friend@example.com" },
    });
    await expect(leaveHouseholdRequest()).resolves.toEqual({
      ok: true,
      nextPath: "/household/select",
    });
  });
});
