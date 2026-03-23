import type {
  HouseholdMember,
  HouseholdPendingInvite,
} from "@/app/household/members/members-view-utils";
import type { ApiErrorCode } from "@/lib/api-error";

export type HouseholdMembersViewProps = {
  hasElevatedHouseholdRole: boolean;
  initialMembers: HouseholdMember[];
  initialPendingInvites: HouseholdPendingInvite[];
  viewerUserId: number;
};

export type HouseholdMembersApiInvite = {
  id: number | string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

export type HouseholdMembersApiMember = {
  userId: number | string;
  name?: string | null;
  email: string;
  role: string;
  joinedAt: string;
};

export type HouseholdMembersApiErrorResponse = {
  ok: false;
  error: string;
  code: ApiErrorCode;
};

export type HouseholdMembersInviteMutationSuccess = {
  ok: true;
  invite: HouseholdMembersApiInvite;
  inviteEmailSent: boolean;
};

export type HouseholdMembersCreateInviteResponse =
  | HouseholdMembersInviteMutationSuccess
  | (HouseholdMembersApiErrorResponse & {
      existingInvite?: HouseholdMembersApiInvite;
    });

export type HouseholdMembersResendInviteResponse =
  | HouseholdMembersInviteMutationSuccess
  | HouseholdMembersApiErrorResponse;

export type HouseholdMembersRevokeInviteResponse =
  | {
      ok: true;
      revokedInviteId: number;
    }
  | HouseholdMembersApiErrorResponse;

export type HouseholdMembersRoleUpdateResponse =
  | {
      ok: true;
      member: HouseholdMembersApiMember;
    }
  | HouseholdMembersApiErrorResponse;

export type HouseholdMembersRemoveResponse =
  | {
      ok: true;
      removedUserId: number;
    }
  | HouseholdMembersApiErrorResponse;

export type HouseholdMembersTransferOwnershipResponse =
  | {
      ok: true;
      members: HouseholdMembersApiMember[];
      transferredToUserId: number;
    }
  | HouseholdMembersApiErrorResponse;

export type HouseholdMembersLeaveResponse =
  | {
      ok: true;
      activeHouseholdActivated: boolean;
      leftHouseholdId: number;
      nextPath: "/household" | "/household/select" | "/household/setup";
    }
  | HouseholdMembersApiErrorResponse;
