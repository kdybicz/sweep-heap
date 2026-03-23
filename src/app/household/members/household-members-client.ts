import { readApiJsonResponse } from "@/app/household/household-context-client";
import type {
  HouseholdMembersApiInvite,
  HouseholdMembersApiMember,
  HouseholdMembersCreateInviteResponse,
  HouseholdMembersLeaveResponse,
  HouseholdMembersRemoveResponse,
  HouseholdMembersResendInviteResponse,
  HouseholdMembersRevokeInviteResponse,
  HouseholdMembersRoleUpdateResponse,
  HouseholdMembersTransferOwnershipResponse,
} from "@/app/household/members/household-members-view.types";
import {
  type HouseholdMember,
  type HouseholdMemberRole,
  type HouseholdPendingInvite,
  toHouseholdMemberRole,
} from "@/app/household/members/members-view-utils";

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> => {
  const response = await fetch(input, init);
  return readApiJsonResponse<T>(response);
};

const requestJsonWithBody = async <T>(
  input: RequestInfo | URL,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<T | null> =>
  requestJson<T>(input, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

export const toPendingInvite = (invite: HouseholdMembersApiInvite): HouseholdPendingInvite => ({
  id: Number(invite.id),
  email: String(invite.email),
  role: toHouseholdMemberRole(invite.role),
  createdAt: String(invite.createdAt),
  expiresAt: String(invite.expiresAt),
});

export const toMember = (member: HouseholdMembersApiMember): HouseholdMember => ({
  userId: Number(member.userId),
  name: typeof member.name === "string" ? member.name : null,
  email: String(member.email),
  role: toHouseholdMemberRole(member.role),
  joinedAt: String(member.joinedAt),
});

export const createHouseholdMemberInvite = async (email: string) =>
  requestJsonWithBody<HouseholdMembersCreateInviteResponse>("/api/households/members", "POST", {
    email,
  });

export const resendHouseholdMemberInvite = async (inviteId: number) =>
  requestJson<HouseholdMembersResendInviteResponse>(`/api/households/members/invites/${inviteId}`, {
    method: "POST",
  });

export const revokeHouseholdMemberInvite = async (inviteId: number) =>
  requestJson<HouseholdMembersRevokeInviteResponse>(`/api/households/members/invites/${inviteId}`, {
    method: "DELETE",
  });

export const updateHouseholdMemberRoleRequest = async ({
  role,
  userId,
}: {
  role: HouseholdMemberRole;
  userId: number;
}) =>
  requestJsonWithBody<HouseholdMembersRoleUpdateResponse>("/api/households/members", "PATCH", {
    userId,
    role,
  });

export const removeHouseholdMemberRequest = async (userId: number) =>
  requestJsonWithBody<HouseholdMembersRemoveResponse>("/api/households/members", "DELETE", {
    userId,
  });

export const transferHouseholdOwnershipRequest = async (userId: number) =>
  requestJsonWithBody<HouseholdMembersTransferOwnershipResponse>(
    "/api/households/members/owner-transfer",
    "POST",
    { userId },
  );

export const leaveHouseholdRequest = async () =>
  requestJson<HouseholdMembersLeaveResponse>("/api/households/members/leave", {
    method: "POST",
  });
