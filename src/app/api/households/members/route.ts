import { requireApiHousehold, requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, type ApiErrorCode, jsonError } from "@/lib/api-error";
import {
  validateHouseholdInvitePayload,
  validateHouseholdMemberRemovePayload,
  validateHouseholdMemberRoleUpdatePayload,
} from "@/lib/api-payload-validation";
import { getHouseholdMembersSnapshot } from "@/lib/household-members";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdMemberInvite,
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from "@/lib/services";

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

const jsonServiceFailure = ({
  headers,
  result,
}: {
  headers: Headers;
  result: { ok: false; status: number; code: ApiErrorCode; error: string } & Record<
    string,
    unknown
  >;
}) => {
  const { ok: _ok, status, ...payload } = result;
  return jsonError({ headers, status, ...payload });
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

    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    const result = await createHouseholdMemberInvite({
      email,
      householdId: household.id,
      householdName: household.name,
      inviterName,
      request,
    });
    if (!result.ok) {
      return jsonServiceFailure({ headers: householdAccess.responseHeaders, result });
    }

    return Response.json(
      { ok: true, ...result.data },
      { headers: householdAccess.responseHeaders },
    );
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

    const result = await updateHouseholdMemberRole({
      actorRole: household.role,
      actorUserId: sessionContext.userId,
      householdId: household.id,
      nextRole: role,
      requestHeaders: request.headers,
      targetUserId,
    });
    if (!result.ok) {
      return jsonServiceFailure({ headers: adminAccess.responseHeaders, result });
    }

    return Response.json({ ok: true, ...result.data }, { headers: adminAccess.responseHeaders });
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

    const result = await removeHouseholdMember({
      actorRole: household.role,
      actorUserId: sessionContext.userId,
      householdId: household.id,
      requestHeaders: request.headers,
      targetUserId,
    });
    if (!result.ok) {
      return jsonServiceFailure({ headers: adminAccess.responseHeaders, result });
    }

    return Response.json({ ok: true, ...result.data }, { headers: adminAccess.responseHeaders });
  } catch (error) {
    return handleUnexpectedError("remove-member", responseHeaders, error);
  }
}
