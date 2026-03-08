import { auth } from "@/auth";
import { requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import { parsePositiveInt } from "@/lib/organization-api";
import { getHouseholdSummaryForUser } from "@/lib/repositories";

export const dynamic = "force-dynamic";

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

    const householdId = parsePositiveInt(payload.householdId);
    if (householdId === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Household id is required",
      });
    }

    const household = await getHouseholdSummaryForUser({
      householdId,
      userId: sessionAccess.sessionContext.userId,
    });
    if (!household) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
        error: "Household not found",
      });
    }

    const setActiveResponse = await auth.api.setActiveOrganization({
      asResponse: true,
      body: {
        organizationId: String(householdId),
      },
      headers: request.headers,
    });
    const responseHeaders = new Headers();
    for (const [key, value] of setActiveResponse.headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
        responseHeaders.append(key, value);
      }
    }

    return Response.json(
      {
        ok: true,
        household,
        householdId,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error("Failed to switch active household", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to switch active household",
    });
  }
}
