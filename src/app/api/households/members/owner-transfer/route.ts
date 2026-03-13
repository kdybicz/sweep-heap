import { auth } from "@/auth";
import { requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { validateHouseholdOwnerTransferPayload } from "@/lib/api-payload-validation";
import { parseJsonObjectBody } from "@/lib/http";
import {
  isMemberNotFoundError,
  mapOrganizationMember,
  type OrganizationMemberLike,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import { withHouseholdMutationLock } from "@/lib/services/ownership-guard-service";

export const dynamic = "force-dynamic";

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

const mapMemberMutationError = (error: unknown, headers: Headers) => {
  const authApiError = toAuthApiError(error);
  if (isMemberNotFoundError(authApiError)) {
    return jsonError({
      headers,
      status: 404,
      code: API_ERROR_CODE.MEMBER_NOT_FOUND,
      error: "Member not found",
    });
  }

  return null;
};

export async function POST(request: Request) {
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const { household, sessionContext } = adminAccess;

    if (household.role !== "owner") {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 403,
        code: API_ERROR_CODE.OWNER_ROLE_MANAGEMENT_FORBIDDEN,
        error: "Only owners can transfer ownership",
      });
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdOwnerTransferPayload(payload);
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
        code: API_ERROR_CODE.OWNER_TRANSFER_SELF_FORBIDDEN,
        error: "Owners cannot transfer ownership to themselves",
      });
    }

    return await withHouseholdMutationLock({
      householdId: household.id,
      task: async () => {
        const members = await listOrganizationMembers({ householdId: household.id, request });
        const actorMember =
          members.find((member) => parsePositiveInt(member.userId) === sessionContext.userId) ??
          null;
        const targetMember =
          members.find((member) => parsePositiveInt(member.userId) === targetUserId) ?? null;

        if (!actorMember || !targetMember) {
          return jsonError({
            headers: adminAccess.responseHeaders,
            status: 404,
            code: API_ERROR_CODE.MEMBER_NOT_FOUND,
            error: "Member not found",
          });
        }

        if (targetMember.role === "owner") {
          return jsonError({
            headers: adminAccess.responseHeaders,
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
              organizationId: String(household.id),
            },
            headers: request.headers,
          })) as OrganizationMemberLike;
        } catch (error) {
          const mappedError = mapMemberMutationError(error, adminAccess.responseHeaders);
          if (mappedError) {
            return mappedError;
          }
          throw error;
        }

        try {
          const demotedActor = (await auth.api.updateMemberRole({
            body: {
              memberId: String(actorMember.id),
              role: "admin",
              organizationId: String(household.id),
            },
            headers: request.headers,
          })) as OrganizationMemberLike;

          const refreshedMembers = await listOrganizationMembers({
            householdId: household.id,
            request,
          });
          const responseMembers = [
            refreshedMembers.find((member) => parsePositiveInt(member.userId) === targetUserId) ??
              promotedTarget,
            refreshedMembers.find(
              (member) => parsePositiveInt(member.userId) === sessionContext.userId,
            ) ?? demotedActor,
          ];

          return Response.json(
            {
              ok: true,
              transferredToUserId: targetUserId,
              members: responseMembers.map(mapOrganizationMember),
            },
            { headers: adminAccess.responseHeaders },
          );
        } catch (error) {
          try {
            await auth.api.updateMemberRole({
              body: {
                memberId: String(targetMember.id),
                role: targetMember.role,
                organizationId: String(household.id),
              },
              headers: request.headers,
            });
          } catch (rollbackError) {
            console.error("Failed to roll back ownership transfer", rollbackError);
          }

          const mappedError = mapMemberMutationError(error, adminAccess.responseHeaders);
          if (mappedError) {
            return mappedError;
          }

          throw error;
        }
      },
    });
  } catch (error) {
    console.error("Failed to transfer household ownership", error);
    return jsonError({
      headers: responseHeaders,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to transfer household ownership",
    });
  }
}
