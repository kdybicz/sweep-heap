import { getSession } from "@/auth";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveHouseholdId, getUserMemberships, updateUserNameById } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const getSessionContext = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      session,
      userId: null,
      status: 401,
      error: "Unauthorized",
    };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return {
      session,
      userId: null,
      status: 400,
      error: "Invalid user",
    };
  }

  return {
    session,
    userId,
    status: 200,
    error: null,
  };
};

const handleUnexpectedError = (action: "load" | "update", error: unknown) => {
  const message = action === "load" ? "Failed to load user" : "Failed to update user";
  console.error(message, error);
  return Response.json({ ok: false, error: message }, { status: 500 });
};

export async function GET() {
  try {
    const sessionContext = await getSessionContext();
    if (
      sessionContext.error ||
      sessionContext.userId === null ||
      !sessionContext.session?.user?.id
    ) {
      return Response.json(
        { ok: false, error: sessionContext.error ?? "Unauthorized" },
        { status: sessionContext.status },
      );
    }

    const memberships = await getUserMemberships(sessionContext.userId);
    const activeHouseholdId = await getActiveHouseholdId(sessionContext.userId);

    return Response.json({
      ok: true,
      user: {
        id: sessionContext.session.user.id,
        email: sessionContext.session.user.email ?? null,
        name: sessionContext.session.user.name ?? null,
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
    const sessionContext = await getSessionContext();
    if (sessionContext.error || sessionContext.userId === null) {
      return Response.json(
        { ok: false, error: sessionContext.error ?? "Unauthorized" },
        { status: sessionContext.status },
      );
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }

    const user = await updateUserNameById({ userId: sessionContext.userId, name });
    if (!user) {
      return Response.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return Response.json({ ok: true, user });
  } catch (error) {
    return handleUnexpectedError("update", error);
  }
}
