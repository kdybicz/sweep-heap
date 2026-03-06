import { auth } from "@/auth";
import { requireApiHousehold, requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import {
  validateHouseholdInvitePayload,
  validateHouseholdMemberRemovePayload,
  validateHouseholdMemberRoleUpdatePayload,
} from "@/lib/api-payload-validation";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import {
  generateHouseholdInviteSecret,
  hashHouseholdInviteSecret,
} from "@/lib/household-invite-secret";
import { getHouseholdMembersSnapshot } from "@/lib/household-members";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { getAppOrigin, parseJsonObjectBody } from "@/lib/http";
import {
  type AuthApiError,
  isAlreadyInvitedError,
  isAlreadyMemberError,
  isLastOwnerError,
  isMemberNotFoundError,
  isOtherHouseholdError,
  mapOrganizationInvitation,
  mapOrganizationMember,
  type OrganizationInvitationLike,
  type OrganizationMemberLike,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import { setPendingHouseholdInviteSecretHash } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (
  action: "list" | "invite" | "update-role" | "remove-member",
  error: unknown,
) => {
  const message =
    action === "list"
      ? "Failed to load household members"
      : action === "invite"
        ? "Failed to create household invite"
        : action === "update-role"
          ? "Failed to update member role"
          : "Failed to remove household member";

  console.error(message, error);
  return jsonError({
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: message,
  });
};

const mapInviteCreateError = ({
  existingInvite,
  authApiError,
}: {
  authApiError: AuthApiError;
  existingInvite: OrganizationInvitationLike | null;
}) => {
  if (isAlreadyMemberError(authApiError)) {
    return jsonError({
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_IN_HOUSEHOLD,
      error: "User is already in this household",
    });
  }

  if (isAlreadyInvitedError(authApiError)) {
    return jsonError({
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_INVITED,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      existingInvite: existingInvite ? mapOrganizationInvitation(existingInvite) : undefined,
    });
  }

  if (isOtherHouseholdError(authApiError)) {
    return jsonError({
      status: 409,
      code: API_ERROR_CODE.USER_IN_OTHER_HOUSEHOLD,
      error: "User already belongs to another household",
    });
  }

  return null;
};

const mapLastOwnerError = (authApiError: AuthApiError | null) => {
  if (isLastOwnerError(authApiError)) {
    return jsonError({
      status: 409,
      code: API_ERROR_CODE.LAST_OWNER_REQUIRED,
      error: "At least one household owner must remain",
    });
  }

  return null;
};

const listOrganizationMembers = async ({
  householdId,
  request,
}: {
  householdId: number;
  request: Request;
}) => {
  const memberResult = (await auth.api.listMembers({
    query: {
      organizationId: String(householdId),
    },
    headers: request.headers,
  })) as { members?: OrganizationMemberLike[] };

  return Array.isArray(memberResult?.members) ? memberResult.members : [];
};

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

const findTargetMemberByUserId = async ({
  householdId,
  request,
  targetUserId,
}: {
  householdId: number;
  request: Request;
  targetUserId: number;
}) => {
  const members = await listOrganizationMembers({ householdId, request });
  return members.find((member) => parsePositiveInt(member.userId) === targetUserId) ?? null;
};

const mapMemberMutationError = (authApiError: AuthApiError | null) => {
  if (isMemberNotFoundError(authApiError)) {
    return jsonError({
      status: 404,
      code: API_ERROR_CODE.MEMBER_NOT_FOUND,
      error: "Member not found",
    });
  }

  const lastOwnerError = mapLastOwnerError(authApiError);
  if (lastOwnerError) {
    return lastOwnerError;
  }

  return null;
};

const mapOwnerRoleProtectionError = ({
  actorRole,
  targetRole,
  nextRole,
}: {
  actorRole: string;
  targetRole: string;
  nextRole?: string;
}) => {
  if (actorRole === "admin" && (targetRole === "owner" || nextRole === "owner")) {
    return jsonError({
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  }

  return null;
};

export async function GET(request: Request) {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const { household, sessionContext } = householdAccess;
    const { members, pendingInvites } = await getHouseholdMembersSnapshot({
      householdId: household.id,
      requestHeaders: request.headers,
    });

    return Response.json({
      ok: true,
      household: {
        id: household.id,
        name: household.name,
        role: household.role,
      },
      viewerUserId: sessionContext.userId,
      canAdministerMembers: isHouseholdElevatedRole(household.role),
      members,
      pendingInvites,
    });
  } catch (error) {
    return handleUnexpectedError("list", error);
  }
}

export async function POST(request: Request) {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const { household, sessionContext } = householdAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdInvitePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { email } = payloadValidation.data;

    let invite: OrganizationInvitationLike;
    try {
      invite = (await auth.api.createInvitation({
        body: {
          email,
          role: "member",
          organizationId: String(household.id),
        },
        headers: request.headers,
      })) as OrganizationInvitationLike;
    } catch (error) {
      const authApiError = toAuthApiError(error);
      if (authApiError === null) {
        throw error;
      }

      const existingInvite = isAlreadyInvitedError(authApiError)
        ? ((await listOrganizationInvites({ householdId: household.id, request })).find(
            (pendingInvite) =>
              pendingInvite.status === "pending" &&
              pendingInvite.email.trim().toLowerCase() === email.trim().toLowerCase(),
          ) ?? null)
        : null;

      const mappedInviteError = mapInviteCreateError({
        authApiError,
        existingInvite,
      });

      if (mappedInviteError) {
        return mappedInviteError;
      }

      throw error;
    }

    const inviteId = parsePositiveInt(invite.id);
    if (inviteId === null) {
      throw new Error("Invalid invitation id");
    }

    const inviteSecret = generateHouseholdInviteSecret();
    const inviteSecretHash = hashHouseholdInviteSecret(inviteSecret);
    const storedInviteId = await setPendingHouseholdInviteSecretHash({
      inviteId,
      secretHash: inviteSecretHash,
    });
    if (storedInviteId === null) {
      throw new Error("Failed to store invitation secret");
    }

    const appOrigin = getAppOrigin(request);
    const inviteUrl = new URL("/household/invite", appOrigin);
    inviteUrl.searchParams.set("invitationId", String(inviteId));
    inviteUrl.searchParams.set("secret", inviteSecret);

    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    let inviteEmailSent = false;
    try {
      await sendHouseholdInviteEmail({
        householdName: household.name,
        inviteUrl: inviteUrl.toString(),
        inviterName,
        to: invite.email,
      });
      inviteEmailSent = true;
    } catch (error) {
      console.error("Failed to send household invite email", {
        householdId: household.id,
        inviteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return Response.json({
      ok: true,
      invite: mapOrganizationInvitation(invite),
      inviteEmailSent,
    });
  } catch (error) {
    return handleUnexpectedError("invite", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdMemberRoleUpdatePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { role, userId: targetUserId } = payloadValidation.data;

    if (targetUserId === sessionContext.userId) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.SELF_ROLE_CHANGE_FORBIDDEN,
        error: "Users cannot change their own role",
      });
    }

    const targetMember = await findTargetMemberByUserId({
      householdId: household.id,
      request,
      targetUserId,
    });
    if (!targetMember) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.MEMBER_NOT_FOUND,
        error: "Member not found",
      });
    }

    const ownerRoleProtectionError = mapOwnerRoleProtectionError({
      actorRole: household.role,
      targetRole: targetMember.role,
      nextRole: role,
    });
    if (ownerRoleProtectionError) {
      return ownerRoleProtectionError;
    }

    try {
      const member = (await auth.api.updateMemberRole({
        body: {
          memberId: String(targetMember.id),
          role,
          organizationId: String(household.id),
        },
        headers: request.headers,
      })) as OrganizationMemberLike;

      return Response.json({ ok: true, member: mapOrganizationMember(member) });
    } catch (error) {
      const mappedError = mapMemberMutationError(toAuthApiError(error));
      if (mappedError) {
        return mappedError;
      }

      throw error;
    }
  } catch (error) {
    return handleUnexpectedError("update-role", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdMemberRemovePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { userId: targetUserId } = payloadValidation.data;

    if (targetUserId === sessionContext.userId) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.SELF_MEMBER_REMOVAL_FORBIDDEN,
        error: "Household administrators cannot remove themselves",
      });
    }

    const targetMember = await findTargetMemberByUserId({
      householdId: household.id,
      request,
      targetUserId,
    });
    if (!targetMember) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.MEMBER_NOT_FOUND,
        error: "Member not found",
      });
    }

    const ownerRoleProtectionError = mapOwnerRoleProtectionError({
      actorRole: household.role,
      targetRole: targetMember.role,
    });
    if (ownerRoleProtectionError) {
      return ownerRoleProtectionError;
    }

    try {
      await auth.api.removeMember({
        body: {
          memberIdOrEmail: String(targetMember.id),
          organizationId: String(household.id),
        },
        headers: request.headers,
      });
    } catch (error) {
      const mappedError = mapMemberMutationError(toAuthApiError(error));
      if (mappedError) {
        return mappedError;
      }

      throw error;
    }

    return Response.json({ ok: true, removedUserId: targetUserId });
  } catch (error) {
    return handleUnexpectedError("remove-member", error);
  }
}
