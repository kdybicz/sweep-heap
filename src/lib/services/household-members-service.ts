import { auth } from "@/auth";
import { API_ERROR_CODE, type ApiErrorCode } from "@/lib/api-error";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import {
  type AuthApiError,
  isAlreadyInvitedError,
  isAlreadyMemberError,
  isInvitationNotFoundError,
  isLastOwnerError,
  isMemberNotFoundError,
  mapOrganizationInvitation,
  mapOrganizationMember,
  type OrganizationInvitationLike,
  type OrganizationMemberLike,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import { sendHouseholdInvite } from "@/lib/services/household-invite-service";
import { withHouseholdMutationLock } from "@/lib/services/ownership-guard-service";

type HouseholdMembersServiceFailure<T extends Record<string, unknown> = Record<string, never>> = {
  ok: false;
  status: number;
  code: ApiErrorCode;
  error: string;
} & T;

type HouseholdMembersServiceSuccess<T> = {
  ok: true;
  data: T;
};

type HouseholdMembersServiceResult<
  T,
  TFailure extends Record<string, unknown> = Record<string, never>,
> = HouseholdMembersServiceSuccess<T> | HouseholdMembersServiceFailure<TFailure>;

const serviceSuccess = <T>(data: T): HouseholdMembersServiceSuccess<T> => ({
  ok: true,
  data,
});

function serviceFailure(args: {
  status: number;
  code: ApiErrorCode;
  error: string;
}): HouseholdMembersServiceFailure<Record<string, never>>;
function serviceFailure<T extends Record<string, unknown>>(args: {
  status: number;
  code: ApiErrorCode;
  error: string;
  extras: T;
}): HouseholdMembersServiceFailure<T>;
function serviceFailure<T extends Record<string, unknown> = Record<string, never>>({
  status,
  code,
  error,
  extras,
}: {
  status: number;
  code: ApiErrorCode;
  error: string;
  extras?: T;
}): HouseholdMembersServiceFailure<T> {
  return {
    ok: false,
    status,
    code,
    error,
    ...(extras ?? ({} as T)),
  };
}

const listOrganizationMembers = async ({
  householdId,
  requestHeaders,
}: {
  householdId: number;
  requestHeaders: Headers;
}) => {
  const memberResult = (await auth.api.listMembers({
    query: {
      organizationId: String(householdId),
    },
    headers: requestHeaders,
  })) as { members?: OrganizationMemberLike[] };

  return Array.isArray(memberResult?.members) ? memberResult.members : [];
};

const listOrganizationInvites = async ({
  householdId,
  requestHeaders,
}: {
  householdId: number;
  requestHeaders: Headers;
}) => {
  const invitations = (await auth.api.listInvitations({
    query: {
      organizationId: String(householdId),
    },
    headers: requestHeaders,
  })) as OrganizationInvitationLike[];

  return Array.isArray(invitations) ? invitations : [];
};

const findTargetMemberByUserId = async ({
  householdId,
  requestHeaders,
  targetUserId,
}: {
  householdId: number;
  requestHeaders: Headers;
  targetUserId: number;
}) => {
  const members = await listOrganizationMembers({ householdId, requestHeaders });
  return members.find((member) => parsePositiveInt(member.userId) === targetUserId) ?? null;
};

const findPendingInviteById = async ({
  householdId,
  inviteId,
  requestHeaders,
}: {
  householdId: number;
  inviteId: number;
  requestHeaders: Headers;
}) => {
  const pendingInvites = await listOrganizationInvites({ householdId, requestHeaders });
  return pendingInvites.find(
    (pendingInvite) => Number(pendingInvite.id) === inviteId && pendingInvite.status === "pending",
  );
};

const mapInviteCreateFailure = ({
  existingInvite,
  authApiError,
}: {
  authApiError: AuthApiError;
  existingInvite: OrganizationInvitationLike | null;
}) => {
  if (isAlreadyMemberError(authApiError)) {
    return serviceFailure({
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_IN_HOUSEHOLD,
      error: "User is already in this household",
    });
  }

  if (isAlreadyInvitedError(authApiError)) {
    return serviceFailure({
      status: 409,
      code: API_ERROR_CODE.USER_ALREADY_INVITED,
      error: "Invite already pending for this email. Resend or revoke the existing invite.",
      extras: {
        ...(existingInvite ? { existingInvite: mapOrganizationInvitation(existingInvite) } : {}),
      },
    });
  }

  return null;
};

const mapMemberMutationFailure = (authApiError: AuthApiError | null) => {
  if (isMemberNotFoundError(authApiError)) {
    return serviceFailure({
      status: 404,
      code: API_ERROR_CODE.MEMBER_NOT_FOUND,
      error: "Member not found",
    });
  }

  if (isLastOwnerError(authApiError)) {
    return serviceFailure({
      status: 409,
      code: API_ERROR_CODE.LAST_OWNER_REQUIRED,
      error: "At least one household owner must remain",
    });
  }

  return null;
};

const mapOwnerRoleProtectionFailure = ({
  actorRole,
  targetRole,
  nextRole,
}: {
  actorRole: string;
  targetRole: string;
  nextRole?: string;
}) => {
  if (actorRole === "admin" && (targetRole === "owner" || nextRole === "owner")) {
    return serviceFailure({
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  }

  return null;
};

const mapInviteOwnerRoleProtectionFailure = ({
  actorRole,
  inviteRole,
}: {
  actorRole: string;
  inviteRole: string;
}) => {
  if (inviteRole === "owner" && actorRole !== "owner") {
    return serviceFailure({
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can manage owner roles",
    });
  }

  return null;
};

export const createHouseholdMemberInvite = async ({
  email,
  householdId,
  householdName,
  inviterName,
  request,
}: {
  email: string;
  householdId: number;
  householdName: string;
  inviterName: string;
  request: Request;
}): Promise<
  HouseholdMembersServiceResult<
    { invite: ReturnType<typeof mapOrganizationInvitation>; inviteEmailSent: boolean },
    { existingInvite?: ReturnType<typeof mapOrganizationInvitation> }
  >
> =>
  withHouseholdMutationLock({
    householdId,
    task: async () => {
      let invite: OrganizationInvitationLike;
      try {
        invite = (await auth.api.createInvitation({
          body: {
            email,
            role: "member",
            organizationId: String(householdId),
          },
          headers: request.headers,
        })) as OrganizationInvitationLike;
      } catch (error) {
        const authApiError = toAuthApiError(error);
        if (authApiError === null) {
          throw error;
        }

        const existingInvite = isAlreadyInvitedError(authApiError)
          ? ((await listOrganizationInvites({ householdId, requestHeaders: request.headers })).find(
              (pendingInvite) =>
                pendingInvite.status === "pending" &&
                pendingInvite.email.trim().toLowerCase() === email.trim().toLowerCase(),
            ) ?? null)
          : null;
        const failure = mapInviteCreateFailure({ authApiError, existingInvite });
        if (failure) {
          return failure;
        }

        throw error;
      }

      const { inviteEmailSent } = await sendHouseholdInvite({
        householdId,
        householdName,
        invite,
        inviterName,
        request,
      });

      return serviceSuccess({
        invite: mapOrganizationInvitation(invite),
        inviteEmailSent,
      });
    },
  });

export const updateHouseholdMemberRole = async ({
  actorRole,
  actorUserId,
  householdId,
  nextRole,
  requestHeaders,
  targetUserId,
}: {
  actorRole: string;
  actorUserId: number;
  householdId: number;
  nextRole: string;
  requestHeaders: Headers;
  targetUserId: number;
}): Promise<
  HouseholdMembersServiceResult<{ member: ReturnType<typeof mapOrganizationMember> }>
> => {
  if (targetUserId === actorUserId) {
    return serviceFailure({
      status: 400,
      code: API_ERROR_CODE.SELF_ROLE_CHANGE_FORBIDDEN,
      error: "Users cannot change their own role",
    });
  }

  return withHouseholdMutationLock({
    householdId,
    task: async () => {
      const targetMember = await findTargetMemberByUserId({
        householdId,
        requestHeaders,
        targetUserId,
      });
      if (!targetMember) {
        return serviceFailure({
          status: 404,
          code: API_ERROR_CODE.MEMBER_NOT_FOUND,
          error: "Member not found",
        });
      }

      const ownerRoleProtectionFailure = mapOwnerRoleProtectionFailure({
        actorRole,
        targetRole: targetMember.role,
        nextRole,
      });
      if (ownerRoleProtectionFailure) {
        return ownerRoleProtectionFailure;
      }

      try {
        const member = (await auth.api.updateMemberRole({
          body: {
            memberId: String(targetMember.id),
            role: nextRole,
            organizationId: String(householdId),
          },
          headers: requestHeaders,
        })) as OrganizationMemberLike;

        const refreshedMember =
          (await findTargetMemberByUserId({
            householdId,
            requestHeaders,
            targetUserId,
          })) ?? member;

        return serviceSuccess({ member: mapOrganizationMember(refreshedMember) });
      } catch (error) {
        const failure = mapMemberMutationFailure(toAuthApiError(error));
        if (failure) {
          return failure;
        }

        throw error;
      }
    },
  });
};

export const removeHouseholdMember = async ({
  actorRole,
  actorUserId,
  householdId,
  requestHeaders,
  targetUserId,
}: {
  actorRole: string;
  actorUserId: number;
  householdId: number;
  requestHeaders: Headers;
  targetUserId: number;
}): Promise<HouseholdMembersServiceResult<{ removedUserId: number }>> => {
  if (targetUserId === actorUserId) {
    return serviceFailure({
      status: 400,
      code: API_ERROR_CODE.SELF_MEMBER_REMOVAL_FORBIDDEN,
      error: "Household administrators cannot remove themselves",
    });
  }

  return withHouseholdMutationLock({
    householdId,
    task: async () => {
      const targetMember = await findTargetMemberByUserId({
        householdId,
        requestHeaders,
        targetUserId,
      });
      if (!targetMember) {
        return serviceFailure({
          status: 404,
          code: API_ERROR_CODE.MEMBER_NOT_FOUND,
          error: "Member not found",
        });
      }

      const ownerRoleProtectionFailure = mapOwnerRoleProtectionFailure({
        actorRole,
        targetRole: targetMember.role,
      });
      if (ownerRoleProtectionFailure) {
        return ownerRoleProtectionFailure;
      }

      try {
        await auth.api.removeMember({
          body: {
            memberIdOrEmail: String(targetMember.id),
            organizationId: String(householdId),
          },
          headers: requestHeaders,
        });
      } catch (error) {
        const failure = mapMemberMutationFailure(toAuthApiError(error));
        if (failure) {
          return failure;
        }

        throw error;
      }

      return serviceSuccess({ removedUserId: targetUserId });
    },
  });
};

export const resendHouseholdInvite = async ({
  actorRole,
  householdId,
  householdName,
  inviteId,
  inviterName,
  request,
}: {
  actorRole: string;
  householdId: number;
  householdName: string;
  inviteId: number;
  inviterName: string;
  request: Request;
}): Promise<
  HouseholdMembersServiceResult<{
    invite: ReturnType<typeof mapOrganizationInvitation>;
    inviteEmailSent: boolean;
  }>
> =>
  withHouseholdMutationLock({
    householdId,
    task: async () => {
      const invite = await findPendingInviteById({
        householdId,
        inviteId,
        requestHeaders: request.headers,
      });
      if (!invite) {
        return serviceFailure({
          status: 404,
          code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
          error: "Pending invite not found",
        });
      }

      const ownerRoleProtectionFailure = mapInviteOwnerRoleProtectionFailure({
        actorRole,
        inviteRole: invite.role,
      });
      if (ownerRoleProtectionFailure) {
        return ownerRoleProtectionFailure;
      }

      const inviteRole = isHouseholdElevatedRole(invite.role) ? invite.role : "member";
      const resentInvite = (await auth.api.createInvitation({
        body: {
          organizationId: String(householdId),
          email: invite.email,
          role: inviteRole,
          resend: true,
        },
        headers: request.headers,
      })) as OrganizationInvitationLike;

      const { inviteEmailSent } = await sendHouseholdInvite({
        householdId,
        householdName,
        invite: resentInvite,
        inviterName,
        request,
      });

      return serviceSuccess({
        invite: mapOrganizationInvitation(resentInvite),
        inviteEmailSent,
      });
    },
  });

export const revokeHouseholdInvite = async ({
  actorRole,
  householdId,
  inviteId,
  requestHeaders,
}: {
  actorRole: string;
  householdId: number;
  inviteId: number;
  requestHeaders: Headers;
}): Promise<HouseholdMembersServiceResult<{ revokedInviteId: number }>> =>
  withHouseholdMutationLock({
    householdId,
    task: async () => {
      const invite = await findPendingInviteById({ householdId, inviteId, requestHeaders });
      if (!invite) {
        return serviceFailure({
          status: 404,
          code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
          error: "Pending invite not found",
        });
      }

      const ownerRoleProtectionFailure = mapInviteOwnerRoleProtectionFailure({
        actorRole,
        inviteRole: invite.role,
      });
      if (ownerRoleProtectionFailure) {
        return ownerRoleProtectionFailure;
      }

      await auth.api.cancelInvitation({
        body: {
          invitationId: String(inviteId),
        },
        headers: requestHeaders,
      });

      return serviceSuccess({ revokedInviteId: inviteId });
    },
  });

export const transferHouseholdOwnership = async ({
  actorRole,
  actorUserId,
  householdId,
  requestHeaders,
  targetUserId,
}: {
  actorRole: string;
  actorUserId: number;
  householdId: number;
  requestHeaders: Headers;
  targetUserId: number;
}): Promise<
  HouseholdMembersServiceResult<{
    transferredToUserId: number;
    members: ReturnType<typeof mapOrganizationMember>[];
  }>
> => {
  if (actorRole !== "owner") {
    return serviceFailure({
      status: 403,
      code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
      error: "Only owners can transfer ownership",
    });
  }

  if (targetUserId === actorUserId) {
    return serviceFailure({
      status: 400,
      code: API_ERROR_CODE.OWNER_TRANSFER_SELF_FORBIDDEN,
      error: "Owners cannot transfer ownership to themselves",
    });
  }

  return withHouseholdMutationLock({
    householdId,
    task: async () => {
      const members = await listOrganizationMembers({ householdId, requestHeaders });
      const actorMember =
        members.find((member) => parsePositiveInt(member.userId) === actorUserId) ?? null;
      const targetMember =
        members.find((member) => parsePositiveInt(member.userId) === targetUserId) ?? null;

      if (!actorMember || !targetMember) {
        return serviceFailure({
          status: 404,
          code: API_ERROR_CODE.MEMBER_NOT_FOUND,
          error: "Member not found",
        });
      }

      if (targetMember.role === "owner") {
        return serviceFailure({
          status: 409,
          code: API_ERROR_CODE.VALIDATION_FAILED,
          error: "Member is already an owner",
        });
      }

      let promotedTarget: OrganizationMemberLike;
      try {
        promotedTarget = (await auth.api.updateMemberRole({
          body: {
            memberId: String(targetMember.id),
            role: "owner",
            organizationId: String(householdId),
          },
          headers: requestHeaders,
        })) as OrganizationMemberLike;
      } catch (error) {
        const failure = mapMemberMutationFailure(toAuthApiError(error));
        if (failure) {
          return failure;
        }

        throw error;
      }

      try {
        const demotedActor = (await auth.api.updateMemberRole({
          body: {
            memberId: String(actorMember.id),
            role: "admin",
            organizationId: String(householdId),
          },
          headers: requestHeaders,
        })) as OrganizationMemberLike;

        const refreshedMembers = await listOrganizationMembers({ householdId, requestHeaders });
        const responseMembers = [
          refreshedMembers.find((member) => parsePositiveInt(member.userId) === targetUserId) ??
            promotedTarget,
          refreshedMembers.find((member) => parsePositiveInt(member.userId) === actorUserId) ??
            demotedActor,
        ];

        return serviceSuccess({
          transferredToUserId: targetUserId,
          members: responseMembers.map(mapOrganizationMember),
        });
      } catch (error) {
        try {
          await auth.api.updateMemberRole({
            body: {
              memberId: String(targetMember.id),
              role: targetMember.role,
              organizationId: String(householdId),
            },
            headers: requestHeaders,
          });
        } catch (rollbackError) {
          console.error("Failed to roll back ownership transfer", rollbackError);
        }

        const failure = mapMemberMutationFailure(toAuthApiError(error));
        if (failure) {
          return failure;
        }

        throw error;
      }
    },
  });
};

export const mapHouseholdMemberInviteNotFoundFailure = () =>
  serviceFailure({
    status: 404,
    code: API_ERROR_CODE.PENDING_INVITE_NOT_FOUND,
    error: "Pending invite not found",
  });

export const isHouseholdMemberInviteNotFoundError = (error: unknown) =>
  isInvitationNotFoundError(toAuthApiError(error));
