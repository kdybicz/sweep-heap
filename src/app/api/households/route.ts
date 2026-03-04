import { DateTime } from "luxon";

import { getSession } from "@/auth";
import { parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdWithOwner,
  getActiveHouseholdSummary,
  getUserMemberships,
  updateHouseholdById,
} from "@/lib/repositories";

export const dynamic = "force-dynamic";

const toTimeZone = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return "UTC";
  }
  const trimmed = value.trim();
  const valid = DateTime.local().setZone(trimmed).isValid;
  return valid ? trimmed : "UTC";
};

const toIcon = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 16);
};

const getSessionUserId = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return null;
  }

  return userId;
};

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }

  return Response.json({ ok: true, household });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseJsonObjectBody(request);
  if (payload === null) {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return Response.json({ ok: false, error: "Household name is required" }, { status: 400 });
  }

  const memberships = await getUserMemberships(userId);
  if (memberships.length) {
    return Response.json(
      { ok: false, error: "User already belongs to a household" },
      { status: 409 },
    );
  }

  const timeZone = toTimeZone(payload?.timeZone);
  const icon = toIcon(payload?.icon);
  const householdId = await createHouseholdWithOwner({ userId, name, timeZone, icon });

  return Response.json({ ok: true, householdId });
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }
  if (household.role !== "admin") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await parseJsonObjectBody(request);
  if (payload === null) {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return Response.json({ ok: false, error: "Household name is required" }, { status: 400 });
  }

  const timeZone = toTimeZone(payload?.timeZone);
  const icon = toIcon(payload?.icon);
  const updated = await updateHouseholdById({
    householdId: household.id,
    name,
    timeZone,
    icon,
  });

  if (!updated) {
    return Response.json({ ok: false, error: "Household not found" }, { status: 404 });
  }

  return Response.json({ ok: true, household: updated });
}
