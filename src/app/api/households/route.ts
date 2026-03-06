import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { requireApiHousehold, requireApiHouseholdAdmin, requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdWithOwner,
  getUserMemberships,
  updateHouseholdById,
} from "@/lib/repositories";

export const dynamic = "force-dynamic";

const parseTimeZone = (value: unknown) => {
  if (value === undefined || value === null) {
    return {
      ok: true as const,
      timeZone: "UTC",
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false as const,
    };
  }

  const valid = DateTime.local().setZone(trimmed).isValid;
  if (!valid) {
    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    timeZone: trimmed,
  };
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

const toSlugBase = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalized || "household";
};

const buildHouseholdSlug = (name: string) =>
  `${toSlugBase(name)}-${randomBytes(4).toString("hex")}`;

const handleUnexpectedError = (action: "load" | "create" | "update", error: unknown) => {
  const message =
    action === "load"
      ? "Failed to load household"
      : action === "create"
        ? "Failed to create household"
        : "Failed to update household";

  console.error(message, error);
  return jsonError({
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: message,
  });
};

export async function GET() {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    return Response.json({ ok: true, household: householdAccess.household });
  } catch (error) {
    return handleUnexpectedError("load", error);
  }
}

export async function POST(request: Request) {
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
        code: API_ERROR_CODE.HOUSEHOLD_NAME_REQUIRED,
        error: "Household name is required",
      });
    }

    const memberships = await getUserMemberships(sessionAccess.sessionContext.userId);
    if (memberships.length) {
      return jsonError({
        status: 409,
        code: API_ERROR_CODE.HOUSEHOLD_ALREADY_EXISTS_FOR_USER,
        error: "User already belongs to a household",
      });
    }

    const parsedTimeZone = parseTimeZone(payload?.timeZone);
    if (!parsedTimeZone.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_TIME_ZONE,
        error: "Invalid time zone",
      });
    }

    const timeZone = parsedTimeZone.timeZone;
    const icon = toIcon(payload?.icon);
    const householdId = await createHouseholdWithOwner({
      userId: sessionAccess.sessionContext.userId,
      name,
      slug: buildHouseholdSlug(name),
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
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const { household } = adminAccess;

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
        code: API_ERROR_CODE.HOUSEHOLD_NAME_REQUIRED,
        error: "Household name is required",
      });
    }

    const parsedTimeZone = parseTimeZone(payload?.timeZone);
    if (!parsedTimeZone.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_TIME_ZONE,
        error: "Invalid time zone",
      });
    }

    const timeZone = parsedTimeZone.timeZone;
    const icon = toIcon(payload?.icon);
    const updated = await updateHouseholdById({
      householdId: household.id,
      name,
      timeZone,
      icon,
    });

    if (!updated) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
        error: "Household not found",
      });
    }

    return Response.json({ ok: true, household: updated });
  } catch (error) {
    return handleUnexpectedError("update", error);
  }
}
