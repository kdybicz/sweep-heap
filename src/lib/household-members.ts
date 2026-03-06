import { auth } from "@/auth";
import {
  mapOrganizationInvitation,
  mapOrganizationMember,
  type OrganizationInvitationLike,
  type OrganizationMemberLike,
} from "@/lib/organization-api";

type AuthOrganizationLike = {
  members?: OrganizationMemberLike[];
  invitations?: OrganizationInvitationLike[];
};

export const getHouseholdMembersSnapshot = async ({
  householdId,
  requestHeaders,
}: {
  householdId: number;
  requestHeaders: Headers;
}) => {
  const fullOrganization = (await auth.api.getFullOrganization({
    query: {
      organizationId: String(householdId),
    },
    headers: requestHeaders,
  })) as AuthOrganizationLike | null;

  const members = Array.isArray(fullOrganization?.members)
    ? fullOrganization.members.map(mapOrganizationMember)
    : [];
  const pendingInvites = Array.isArray(fullOrganization?.invitations)
    ? fullOrganization.invitations
        .filter((invite) => invite.status === "pending")
        .filter((invite) => new Date(invite.expiresAt).getTime() > Date.now())
        .map(mapOrganizationInvitation)
    : [];

  return {
    members,
    pendingInvites,
  };
};
