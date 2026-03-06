import { requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveHouseholdId, getUserMemberships, updateUserNameById } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (action: "load" | "update", error: unknown) => {
  const message = action === "load" ? "Failed to load user" : "Failed to update user";
  console.error(message, error);
  return jsonError({
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: message,
  });
};

export async function GET() {
  try {
    const sessionAccess = await requireApiSession();
    if (!sessionAccess.ok) {
      return sessionAccess.response;
    }

    const memberships = await getUserMemberships(sessionAccess.sessionContext.userId);
    const activeHouseholdId = await getActiveHouseholdId(sessionAccess.sessionContext.userId);

    return Response.json({
      ok: true,
      user: {
        id: sessionAccess.sessionContext.sessionUserId,
        email: sessionAccess.sessionContext.sessionUserEmail,
        name: sessionAccess.sessionContext.sessionUserName,
      },
      memberships,
      activeHouseholdId,
    });
  } catch (error) {
    return handleUnexpectedError("load", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionAccess = await requireApiSession();
    if (!sessionAccess.ok) {
      return sessionAccess.response;
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.NAME_REQUIRED,
        error: "Name is required",
      });
    }

    const user = await updateUserNameById({ userId: sessionAccess.sessionContext.userId, name });
    if (!user) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.USER_NOT_FOUND,
        error: "User not found",
      });
    }

    return Response.json({ ok: true, user });
  } catch (error) {
    return handleUnexpectedError("update", error);
  }
}
