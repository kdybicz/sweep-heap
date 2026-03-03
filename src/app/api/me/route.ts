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

export async function GET() {
  const sessionContext = await getSessionContext();
  if (sessionContext.error || sessionContext.userId === null || !sessionContext.session?.user?.id) {
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
}

export async function PATCH(request: Request) {
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
}
