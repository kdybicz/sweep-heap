import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  closeActionsMenuMock,
  createInviteMock,
  leaveHouseholdMock,
  pushMock,
  recoverFromHouseholdContextErrorMock,
  refreshMock,
  removeMemberMock,
  resendInviteMock,
  revokeInviteMock,
  transferOwnershipMock,
  updateMemberRoleMock,
} = vi.hoisted(() => ({
  closeActionsMenuMock: vi.fn(),
  createInviteMock: vi.fn(),
  leaveHouseholdMock: vi.fn(),
  pushMock: vi.fn(),
  recoverFromHouseholdContextErrorMock: vi.fn(),
  refreshMock: vi.fn(),
  removeMemberMock: vi.fn(),
  resendInviteMock: vi.fn(),
  revokeInviteMock: vi.fn(),
  transferOwnershipMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/app/household/household-context-client", () => ({
  recoverFromHouseholdContextError: recoverFromHouseholdContextErrorMock,
}));

vi.mock("@/app/household/members/household-members-client", () => ({
  createHouseholdMemberInvite: createInviteMock,
  leaveHouseholdRequest: leaveHouseholdMock,
  removeHouseholdMemberRequest: removeMemberMock,
  resendHouseholdMemberInvite: resendInviteMock,
  revokeHouseholdMemberInvite: revokeInviteMock,
  toMember: (member: {
    userId: number | string;
    name?: string | null;
    email: string;
    role: string;
    joinedAt: string;
  }) => ({
    userId: Number(member.userId),
    name: typeof member.name === "string" ? member.name : null,
    email: member.email,
    role: member.role === "owner" || member.role === "admin" ? member.role : "member",
    joinedAt: member.joinedAt,
  }),
  toPendingInvite: (invite: {
    id: number | string;
    email: string;
    role: string;
    createdAt: string;
    expiresAt: string;
  }) => ({
    id: Number(invite.id),
    email: invite.email,
    role: invite.role === "owner" || invite.role === "admin" ? invite.role : "member",
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  }),
  transferHouseholdOwnershipRequest: transferOwnershipMock,
  updateHouseholdMemberRoleRequest: updateMemberRoleMock,
}));

import { useHouseholdMembersActions } from "@/app/household/members/useHouseholdMembersActions";

type HookValue = ReturnType<typeof useHouseholdMembersActions>;

const member = {
  userId: 7,
  name: "Taylor",
  email: "taylor@example.com",
  role: "member" as const,
  joinedAt: "2026-01-02T00:00:00.000Z",
};

const invite = {
  id: 12,
  email: "friend@example.com",
  role: "member" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-08T00:00:00.000Z",
};

const renderHookHarness = () => {
  let hookValue: HookValue | undefined;

  function Harness() {
    hookValue = useHouseholdMembersActions({
      closeActionsMenu: closeActionsMenuMock,
      initialMembers: [member],
      initialPendingInvites: [invite],
      viewerUserId: member.userId,
    });
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!hookValue) {
    throw new Error("Hook harness failed to initialize");
  }

  return hookValue;
};

describe("useHouseholdMembersActions", () => {
  beforeEach(() => {
    closeActionsMenuMock.mockReset();
    createInviteMock.mockReset();
    leaveHouseholdMock.mockReset();
    pushMock.mockReset();
    recoverFromHouseholdContextErrorMock.mockReset();
    refreshMock.mockReset();
    removeMemberMock.mockReset();
    resendInviteMock.mockReset();
    revokeInviteMock.mockReset();
    transferOwnershipMock.mockReset();
    updateMemberRoleMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("closes the actions menu and bails out when resend hits a household recovery response", async () => {
    resendInviteMock.mockResolvedValue({
      ok: false,
      code: "HOUSEHOLD_SELECTION_REQUIRED",
      error: "Active household selection required",
    });
    recoverFromHouseholdContextErrorMock.mockReturnValue(true);

    const hook = renderHookHarness();
    await hook.handleResendInvite(invite);

    expect(resendInviteMock).toHaveBeenCalledWith(invite.id);
    expect(closeActionsMenuMock).toHaveBeenCalledTimes(1);
    expect(recoverFromHouseholdContextErrorMock).toHaveBeenCalledWith({
      ok: false,
      code: "HOUSEHOLD_SELECTION_REQUIRED",
      error: "Active household selection required",
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not call leave when the user cancels the confirmation", async () => {
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("window", { confirm: confirmMock });

    const hook = renderHookHarness();
    await hook.handleLeaveHousehold();

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(leaveHouseholdMock).not.toHaveBeenCalled();
    expect(closeActionsMenuMock).not.toHaveBeenCalled();
  });

  it("redirects and refreshes after a successful leave response", async () => {
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmMock });
    leaveHouseholdMock.mockResolvedValue({
      ok: true,
      nextPath: "/household/select",
    });
    recoverFromHouseholdContextErrorMock.mockReturnValue(false);

    const hook = renderHookHarness();
    await hook.handleLeaveHousehold();

    expect(leaveHouseholdMock).toHaveBeenCalledTimes(1);
    expect(closeActionsMenuMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/household/select");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("stops after ownership transfer returns a recoverable household context error", async () => {
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmMock });
    transferOwnershipMock.mockResolvedValue({
      ok: false,
      code: "HOUSEHOLD_NOT_FOUND",
      error: "Household not found",
    });
    recoverFromHouseholdContextErrorMock.mockReturnValue(true);

    const hook = renderHookHarness();
    await hook.handleTransferOwnership(member);

    expect(transferOwnershipMock).toHaveBeenCalledWith(member.userId);
    expect(closeActionsMenuMock).toHaveBeenCalledTimes(1);
    expect(recoverFromHouseholdContextErrorMock).toHaveBeenCalledWith({
      ok: false,
      code: "HOUSEHOLD_NOT_FOUND",
      error: "Household not found",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
