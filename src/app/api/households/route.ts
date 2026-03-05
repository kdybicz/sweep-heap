import { DateTime } from "luxon";

import { parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdWithOwner,
  getActiveHouseholdSummary,
  getUserMemberships,
  updateHouseholdById,
} from "@/lib/repositories";
import { getSessionContext, sessionErrorResponse } from "@/lib/session-context";

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

const handleUnexpectedError = (action: "load" | "create" | "update", error: unknown) => {
  const message =
    action === "load"
      ? "Failed to load household"
      : action === "create"
        ? "Failed to create household"
        : "Failed to update household";

  console.error(message, error);
  return Response.json({ ok: false, error: message }, { status: 500 });
};

export async function GET() {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext.ok) {
      return sessionErrorResponse(sessionContext);
    }

    const household = await getActiveHouseholdSummary(sessionContext.userId);
    if (!household) {
      return Response.json({ ok: false, error: "Household required" }, { status: 403 });
    }

    return Response.json({ ok: true, household });
  } catch (error) {
    return handleUnexpectedError("load", error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext.ok) {
      return sessionErrorResponse(sessionContext);
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return Response.json({ ok: false, error: "Household name is required" }, { status: 400 });
    }

    const memberships = await getUserMemberships(sessionContext.userId);
    if (memberships.length) {
      return Response.json(
        { ok: false, error: "User already belongs to a household" },
        { status: 409 },
      );
    }

    const timeZone = toTimeZone(payload?.timeZone);
    const icon = toIcon(payload?.icon);
    const householdId = await createHouseholdWithOwner({
      userId: sessionContext.userId,
      name,
      timeZone,
      icon,
    });

    return Response.json({ ok: true, householdId });
  } catch (error) {
    return handleUnexpectedError("create", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext.ok) {
      return sessionErrorResponse(sessionContext);
    }

    const household = await getActiveHouseholdSummary(sessionContext.userId);
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
  } catch (error) {
    return handleUnexpectedError("update", error);
  }
}
