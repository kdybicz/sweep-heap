import { auth } from "@/auth";
import { requireApiHousehold, requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import {
  isInvitationNotFoundError,
  mapOrganizationInvitation,
  type OrganizationInvitationLike,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import { sendHouseholdInvite } from "@/lib/services/household-invite-service";

export const dynamic = "force-dynamic";

const listOrganizationInvites = async ({
  householdId,
  request,
}: {
  householdId: number;
  request: Request;
}) => {
  const invitations = (await auth.api.listInvitations({
    query: {
      organizationId: String(householdId),
    },
    headers: request.headers,
  })) as OrganizationInvitationLike[];

  return Array.isArray(invitations) ? invitations : [];
};

const mapOwnerRoleProtectionError = ({
  actorRole,
  inviteRole,
}: {
  actorRole: string;
  inviteRole: string;
}) => {
  if (inviteRole === "owner" && actorRole !== "owner") {
    return jsonError({
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  }

  return null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const { household, sessionContext } = householdAccess;

    const resolvedParams = await params;
    const inviteId = parsePositiveInt(resolvedParams.inviteId);
    if (inviteId === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Invite id is required",
      });
    }

    const pendingInvites = await listOrganizationInvites({ householdId: household.id, request });
    const invite = pendingInvites.find((pendingInvite) => Number(pendingInvite.id) === inviteId);
    if (!invite || invite.status !== "pending") {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
        error: "Pending invite not found",
      });
    }

    const ownerRoleProtectionError = mapOwnerRoleProtectionError({
      actorRole: household.role,
      inviteRole: invite.role,
    });
    if (ownerRoleProtectionError) {
      return ownerRoleProtectionError;
    }

    const inviteRole = isHouseholdElevatedRole(invite.role) ? invite.role : "member";

    const resentInvite = (await auth.api.createInvitation({
      body: {
        organizationId: String(household.id),
        email: invite.email,
        role: inviteRole,
        resend: true,
      },
      headers: request.headers,
    })) as OrganizationInvitationLike;

    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    const { inviteEmailSent } = await sendHouseholdInvite({
      householdId: household.id,
      householdName: household.name,
      invite: resentInvite,
      inviterName,
      request,
    });

    return Response.json({
      ok: true,
      invite: mapOrganizationInvitation(resentInvite),
      inviteEmailSent,
    });
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
        error: "Pending invite not found",
      });
    }

    console.error("Failed to resend household invite", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to resend household invite",
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const resolvedParams = await params;
    const inviteId = parsePositiveInt(resolvedParams.inviteId);
    if (inviteId === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Invite id is required",
      });
    }

    const pendingInvites = await listOrganizationInvites({
      householdId: adminAccess.household.id,
      request,
    });
    const invite = pendingInvites.find((pendingInvite) => Number(pendingInvite.id) === inviteId);
    if (!invite || invite.status !== "pending") {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
        error: "Pending invite not found",
      });
    }

    const ownerRoleProtectionError = mapOwnerRoleProtectionError({
      actorRole: adminAccess.household.role,
      inviteRole: invite.role,
    });
    if (ownerRoleProtectionError) {
      return ownerRoleProtectionError;
    }

    await auth.api.cancelInvitation({
      body: {
        invitationId: String(inviteId),
      },
      headers: request.headers,
    });

    return Response.json({
      ok: true,
      revokedInviteId: inviteId,
    });
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
        error: "Pending invite not found",
      });
    }

    console.error("Failed to revoke household invite", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to revoke household invite",
    });
  }
}
