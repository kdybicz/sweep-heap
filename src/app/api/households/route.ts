import { DateTime } from "luxon";

import { auth } from "@/auth";
import { createHouseholdWithOwner, getUserMemberships } from "@/lib/households";

export const dynamic = "force-dynamic";

const toTimeZone = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return "UTC";
  }
  const trimmed = value.trim();
  const valid = DateTime.local().setZone(trimmed).isValid;
  return valid ? trimmed : "UTC";
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return Response.json({ ok: false, error: "Household name is required" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
  }

  const memberships = await getUserMemberships(userId);
  if (memberships.length) {
    return Response.json(
      { ok: false, error: "User already belongs to a household" },
      { status: 409 },
    );
  }

  const timeZone = toTimeZone(payload?.timeZone);
  const householdId = await createHouseholdWithOwner({ userId, name, timeZone });

  return Response.json({ ok: true, householdId });
}
