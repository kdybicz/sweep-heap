import { requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import { getUserMemberships, updateUserNameById } from "@/lib/repositories";
import { reconcileActiveHouseholdSession, resolveActiveHousehold } from "@/lib/services";

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

type ReconciliationError = Error & {
  responseHeaders?: Headers;
};

const getErrorResponseHeaders = (error: unknown) => {
  const reconciliationError = error as ReconciliationError;
  return reconciliationError.responseHeaders instanceof Headers
    ? reconciliationError.responseHeaders
    : new Headers();
};

const getReconciledResponseHeaders = async ({
  request,
  sessionActiveHouseholdId,
  resolution,
}: {
  request: Request | undefined;
  sessionActiveHouseholdId: number | null;
  resolution: Awaited<ReturnType<typeof resolveActiveHousehold>>;
}) => {
  if (!request) {
    return new Headers();
  }

  try {
    return await reconcileActiveHouseholdSession({
      requestHeaders: request.headers,
      resolution,
      sessionActiveHouseholdId,
    });
  } catch (error) {
    console.error("Failed to reconcile active household session during /api/me", error);
    return getErrorResponseHeaders(error);
  }
};

export async function GET(request?: Request) {
  let responseHeaders = new Headers();
  try {
    const sessionAccess = await requireApiSession();
    if (!sessionAccess.ok) {
      return sessionAccess.response;
    }

    const memberships = await getUserMemberships(sessionAccess.sessionContext.userId);
    const activeHousehold = await resolveActiveHousehold({
      sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
      userId: sessionAccess.sessionContext.userId,
    });
    responseHeaders = await getReconciledResponseHeaders({
      request,
      resolution: activeHousehold,
      sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
    });
    const activeHouseholdId =
      activeHousehold.status === "resolved" ? activeHousehold.household.id : null;

    return Response.json(
      {
        ok: true,
        user: {
          id: sessionAccess.sessionContext.sessionUserId,
          email: sessionAccess.sessionContext.sessionUserEmail,
          name: sessionAccess.sessionContext.sessionUserName,
        },
        memberships,
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
    const sessionAccess = await requireApiSession();
    if (!sessionAccess.ok) {
      return sessionAccess.response;
    }

    const activeHousehold = await resolveActiveHousehold({
      sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
      userId: sessionAccess.sessionContext.userId,
    });
    responseHeaders = await getReconciledResponseHeaders({
      request,
      resolution: activeHousehold,
      sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
    });

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

    const user = await updateUserNameById({ userId: sessionAccess.sessionContext.userId, name });
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
