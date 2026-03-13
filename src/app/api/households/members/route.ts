import { auth } from "@/auth";
import {
  requireApiHousehold,
  requireApiHouseholdAdmin,
  withResponseHeaders,
} from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import {
  validateHouseholdInvitePayload,
  validateHouseholdMemberRemovePayload,
  validateHouseholdMemberRoleUpdatePayload,
} from "@/lib/api-payload-validation";
import { getHouseholdMembersSnapshot } from "@/lib/household-members";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { parseJsonObjectBody } from "@/lib/http";
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
import { sendHouseholdInvite } from "@/lib/services/household-invite-service";
import { withHouseholdMutationLock } from "@/lib/services/ownership-guard-service";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (
  action: "list" | "invite" | "update-role" | "remove-member",
  responseHeaders: Headers,
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
    headers: responseHeaders,
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
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    const { household, sessionContext } = householdAccess;
    const { members, pendingInvites } = await getHouseholdMembersSnapshot({
      householdId: household.id,
      requestHeaders: request.headers,
    });

    return Response.json(
      {
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
      },
      { headers: householdAccess.responseHeaders },
    );
  } catch (error) {
    return handleUnexpectedError("list", responseHeaders, error);
  }
}

export async function POST(request: Request) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    const { household, sessionContext } = householdAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdInvitePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { email } = payloadValidation.data;

    return await withHouseholdMutationLock({
      householdId: household.id,
      task: async () => {
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
            return withResponseHeaders(mappedInviteError, householdAccess.responseHeaders);
          }

          throw error;
        }

        const inviterName =
          sessionContext.sessionUserName?.trim() ||
          sessionContext.sessionUserEmail?.trim() ||
          "A household member";

        const { inviteEmailSent } = await sendHouseholdInvite({
          householdId: household.id,
          householdName: household.name,
          invite,
          inviterName,
          request,
        });

        return Response.json(
          {
            ok: true,
            invite: mapOrganizationInvitation(invite),
            inviteEmailSent,
          },
          { headers: householdAccess.responseHeaders },
        );
      },
    });
  } catch (error) {
    return handleUnexpectedError("invite", responseHeaders, error);
  }
}

export async function PATCH(request: Request) {
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdMemberRoleUpdatePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { role, userId: targetUserId } = payloadValidation.data;

    if (targetUserId === sessionContext.userId) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.SELF_ROLE_CHANGE_FORBIDDEN,
        error: "Users cannot change their own role",
      });
    }

    return await withHouseholdMutationLock({
      householdId: household.id,
      task: async () => {
        const targetMember = await findTargetMemberByUserId({
          householdId: household.id,
          request,
          targetUserId,
        });
        if (!targetMember) {
          return jsonError({
            headers: adminAccess.responseHeaders,
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
          return withResponseHeaders(ownerRoleProtectionError, adminAccess.responseHeaders);
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

          const refreshedMember =
            (await findTargetMemberByUserId({
              householdId: household.id,
              request,
              targetUserId,
            })) ?? member;

          return Response.json(
            { ok: true, member: mapOrganizationMember(refreshedMember) },
            { headers: adminAccess.responseHeaders },
          );
        } catch (error) {
          const mappedError = mapMemberMutationError(toAuthApiError(error));
          if (mappedError) {
            return withResponseHeaders(mappedError, adminAccess.responseHeaders);
          }

          throw error;
        }
      },
    });
  } catch (error) {
    return handleUnexpectedError("update-role", responseHeaders, error);
  }
}

export async function DELETE(request: Request) {
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdMemberRemovePayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { userId: targetUserId } = payloadValidation.data;

    if (targetUserId === sessionContext.userId) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.SELF_MEMBER_REMOVAL_FORBIDDEN,
        error: "Household administrators cannot remove themselves",
      });
    }

    return await withHouseholdMutationLock({
      householdId: household.id,
      task: async () => {
        const targetMember = await findTargetMemberByUserId({
          householdId: household.id,
          request,
          targetUserId,
        });
        if (!targetMember) {
          return jsonError({
            headers: adminAccess.responseHeaders,
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
          return withResponseHeaders(ownerRoleProtectionError, adminAccess.responseHeaders);
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
            return withResponseHeaders(mappedError, adminAccess.responseHeaders);
          }

          throw error;
        }

        return Response.json(
          { ok: true, removedUserId: targetUserId },
          { headers: adminAccess.responseHeaders },
        );
      },
    });
  } catch (error) {
    return handleUnexpectedError("remove-member", responseHeaders, error);
  }
}
