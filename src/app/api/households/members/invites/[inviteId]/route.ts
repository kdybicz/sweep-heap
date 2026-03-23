import { requireApiHousehold, requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, type ApiErrorCode, jsonError } from "@/lib/api-error";
import { parsePositiveInt } from "@/lib/organization-api";
import {
  isHouseholdMemberInviteNotFoundError,
  mapHouseholdMemberInviteNotFoundFailure,
  resendHouseholdInvite,
  revokeHouseholdInvite,
} from "@/lib/services/household-members-service";

export const dynamic = "force-dynamic";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    const { household, sessionContext } = householdAccess;

    const resolvedParams = await params;
    const inviteId = parsePositiveInt(resolvedParams.inviteId);
    if (inviteId === null) {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Invite id is required",
      });
    }

    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    const result = await resendHouseholdInvite({
      actorRole: household.role,
      householdId: household.id,
      householdName: household.name,
      inviteId,
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
    if (isHouseholdMemberInviteNotFoundError(error)) {
      const result = mapHouseholdMemberInviteNotFoundFailure();
      return jsonServiceFailure({ headers: responseHeaders, result });
    }

    console.error("Failed to resend household invite", error);
    return jsonError({
      headers: responseHeaders,
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
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const resolvedParams = await params;
    const inviteId = parsePositiveInt(resolvedParams.inviteId);
    if (inviteId === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Invite id is required",
      });
    }

    const result = await revokeHouseholdInvite({
      actorRole: adminAccess.household.role,
      householdId: adminAccess.household.id,
      inviteId,
      requestHeaders: request.headers,
    });
    if (!result.ok) {
      return jsonServiceFailure({ headers: adminAccess.responseHeaders, result });
    }

    return Response.json({ ok: true, ...result.data }, { headers: adminAccess.responseHeaders });
  } catch (error) {
    if (isHouseholdMemberInviteNotFoundError(error)) {
      const result = mapHouseholdMemberInviteNotFoundFailure();
      return jsonServiceFailure({ headers: responseHeaders, result });
    }

    console.error("Failed to revoke household invite", error);
    return jsonError({
      headers: responseHeaders,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to revoke household invite",
    });
  }
}
