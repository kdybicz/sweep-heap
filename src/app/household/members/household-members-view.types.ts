import type {
  HouseholdMember,
  HouseholdPendingInvite,
} from "@/app/household/members/members-view-utils";

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

export type HouseholdMembersApiResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  existingInvite?: HouseholdMembersApiInvite;
  invite?: HouseholdMembersApiInvite;
  inviteEmailSent?: boolean;
  member?: HouseholdMembersApiMember;
  members?: HouseholdMembersApiMember[];
};

export type HouseholdMembersLeaveResponse = HouseholdMembersApiResponse & {
  activeHouseholdActivated?: boolean;
  nextPath?: string;
};
