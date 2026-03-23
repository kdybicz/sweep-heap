import { requireApiSessionHouseholdResolution } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveUserMemberships, updateUserNameById } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (
  action: "load" | "update",
  responseHeaders: Headers,
  error: unknown,
) => {
  const message = action === "load" ? "Failed to load user" : "Failed to update user";
  console.error(message, error);
  return jsonError({
    headers: responseHeaders,
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: message,
  });
};

export async function GET(request: Request) {
  let responseHeaders = new Headers();
  try {
    const sessionResolutionAccess = await requireApiSessionHouseholdResolution(request.headers);
    if (!sessionResolutionAccess.ok) {
      return sessionResolutionAccess.response;
    }

    const { householdResolution, sessionContext } = sessionResolutionAccess;
    responseHeaders = sessionResolutionAccess.responseHeaders;

    const activeMemberships = await getActiveUserMemberships(sessionContext.userId);
    const activeHouseholdId =
      householdResolution.status === "resolved" ? householdResolution.household.id : null;

    return Response.json(
      {
        ok: true,
        user: {
          id: sessionContext.sessionUserId,
          email: sessionContext.sessionUserEmail,
          name: sessionContext.sessionUserName,
        },
        memberships: activeMemberships,
        activeHouseholdId,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    return handleUnexpectedError("load", responseHeaders, error);
  }
}

export async function PATCH(request: Request) {
  let responseHeaders = new Headers();
  try {
    const sessionResolutionAccess = await requireApiSessionHouseholdResolution(request.headers);
    if (!sessionResolutionAccess.ok) {
      return sessionResolutionAccess.response;
    }

    const { sessionContext } = sessionResolutionAccess;
    responseHeaders = sessionResolutionAccess.responseHeaders;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return jsonError({
        headers: responseHeaders,
        status: 400,
        code: API_ERROR_CODE.NAME_REQUIRED,
        error: "Name is required",
      });
    }

    const user = await updateUserNameById({ userId: sessionContext.userId, name });
    if (!user) {
      return jsonError({
        headers: responseHeaders,
        status: 404,
        code: API_ERROR_CODE.USER_NOT_FOUND,
        error: "User not found",
      });
    }

    return Response.json({ ok: true, user }, { headers: responseHeaders });
  } catch (error) {
    return handleUnexpectedError("update", responseHeaders, error);
  }
}
