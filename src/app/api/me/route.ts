import { requireApiSession } from "@/lib/api-access";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveHouseholdId, getUserMemberships, updateUserNameById } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (action: "load" | "update", error: unknown) => {
  const message = action === "load" ? "Failed to load user" : "Failed to update user";
  console.error(message, error);
  return Response.json({ ok: false, error: message }, { status: 500 });
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
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }

    const user = await updateUserNameById({ userId: sessionAccess.sessionContext.userId, name });
    if (!user) {
      return Response.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return Response.json({ ok: true, user });
  } catch (error) {
    return handleUnexpectedError("update", error);
  }
}
