import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { requireApiHousehold, requireApiHouseholdAdmin, requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdWithOwner,
  listActiveHouseholdsForUser,
  updateHouseholdById,
} from "@/lib/repositories";
import { householdHasOtherActiveMembers, withHouseholdMutationLock } from "@/lib/services";

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

const handleUnexpectedError = (
  action: "load" | "create" | "update" | "delete",
  responseHeaders: Headers,
  error: unknown,
) => {
  const message =
    action === "load"
      ? "Failed to load household"
      : action === "create"
        ? "Failed to create household"
        : action === "update"
          ? "Failed to update household"
          : "Failed to delete household";

  console.error(message, error);
  return jsonError({
    headers: responseHeaders,
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: message,
  });
};

export async function GET(request?: Request) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request?.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    return Response.json(
      { ok: true, household: householdAccess.household },
      { headers: householdAccess.responseHeaders },
    );
  } catch (error) {
    return handleUnexpectedError("load", responseHeaders, error);
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

    const responseHeaders = new Headers();
    try {
      const setActiveResponse = await auth.api.setActiveOrganization({
        asResponse: true,
        body: {
          organizationId: String(householdId),
        },
        headers: request.headers,
      });
      for (const [key, value] of setActiveResponse.headers.entries()) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        }
      }
    } catch (error) {
      console.error("Failed to set active household after create", error);
      return jsonError({
        status: 500,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to activate new household",
      });
    }

    return Response.json({ ok: true, householdId }, { headers: responseHeaders });
  } catch (error) {
    return handleUnexpectedError("create", new Headers(), error);
  }
}

export async function PATCH(request: Request) {
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const { household } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.HOUSEHOLD_NAME_REQUIRED,
        error: "Household name is required",
      });
    }

    const parsedTimeZone = parseTimeZone(payload?.timeZone);
    if (!parsedTimeZone.ok) {
      return jsonError({
        headers: adminAccess.responseHeaders,
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
        headers: adminAccess.responseHeaders,
        status: 404,
        code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
        error: "Household not found",
      });
    }

    return Response.json(
      { ok: true, household: updated },
      { headers: adminAccess.responseHeaders },
    );
  } catch (error) {
    return handleUnexpectedError("update", responseHeaders, error);
  }
}

export async function DELETE(request: Request) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    if (householdAccess.household.role !== "owner") {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 403,
        code: API_ERROR_CODE.FORBIDDEN,
        error: "Only owners can delete households",
      });
    }

    return await withHouseholdMutationLock({
      householdId: householdAccess.household.id,
      task: async () => {
        const hasOtherMembers = await householdHasOtherActiveMembers({
          householdId: householdAccess.household.id,
          userId: householdAccess.sessionContext.userId,
        });
        if (hasOtherMembers) {
          return jsonError({
            headers: householdAccess.responseHeaders,
            status: 409,
            code: API_ERROR_CODE.HOUSEHOLD_HAS_OTHER_MEMBERS,
            error: "Remove other active members before deleting this household",
          });
        }

        const responseHeaders = new Headers(householdAccess.responseHeaders);
        const deleteResponse = await auth.api.deleteOrganization({
          asResponse: true,
          body: {
            organizationId: String(householdAccess.household.id),
          },
          headers: request.headers,
        });
        for (const [key, value] of deleteResponse.headers.entries()) {
          if (key.toLowerCase() === "set-cookie") {
            responseHeaders.append(key, value);
          }
        }

        let nextPath = "/household/setup";
        let activeHouseholdActivated = false;
        try {
          const remainingHouseholds = await listActiveHouseholdsForUser(
            householdAccess.sessionContext.userId,
          );
          if (remainingHouseholds.length === 1) {
            try {
              const setActiveResponse = await auth.api.setActiveOrganization({
                asResponse: true,
                body: {
                  organizationId: String(remainingHouseholds[0].id),
                },
                headers: request.headers,
              });
              for (const [key, value] of setActiveResponse.headers.entries()) {
                if (key.toLowerCase() === "set-cookie") {
                  responseHeaders.append(key, value);
                }
              }
              nextPath = "/household";
              activeHouseholdActivated = true;
            } catch (error) {
              console.error("Failed to activate remaining household after delete", error);
              nextPath = "/household/select";
            }
          } else if (remainingHouseholds.length > 1) {
            nextPath = "/household/select";
          }
        } catch (error) {
          console.error("Failed to inspect remaining households after delete", error);
          nextPath = "/household/select";
        }

        return Response.json(
          {
            ok: true,
            deletedHouseholdId: householdAccess.household.id,
            nextPath,
            activeHouseholdActivated,
          },
          { headers: responseHeaders },
        );
      },
    });
  } catch (error) {
    return handleUnexpectedError("delete", responseHeaders, error);
  }
}
