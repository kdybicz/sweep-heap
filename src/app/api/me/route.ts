import { auth } from "@/auth";
import { getActiveHouseholdId, getUserMemberships } from "@/lib/households";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
  }

  const memberships = await getUserMemberships(userId);
  const activeHouseholdId = await getActiveHouseholdId(userId);

  return Response.json({
    ok: true,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    },
    memberships,
    activeHouseholdId,
  });
}
