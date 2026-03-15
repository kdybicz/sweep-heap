import { requireApiHousehold } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { validateChorePatchPayload } from "@/lib/api-payload-validation";
import { parseJsonObjectBody } from "@/lib/http";
import { HouseholdNotFoundError } from "@/lib/repositories";
import { listChores, mutateChore } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weekOffsetPattern = /^-?\d+$/;
const maxWeekOffset = 520;

const statusForChoreMutationCode = (code: string) => {
  switch (code) {
    case API_ERROR_CODE.ACTION_INVALID:
    case API_ERROR_CODE.STATUS_INVALID:
    case API_ERROR_CODE.VALIDATION_FAILED:
    case API_ERROR_CODE.MISSING_CHORE_OCCURRENCE:
      return 400;
    case API_ERROR_CODE.CHORE_NOT_FOUND:
      return 404;
    case API_ERROR_CODE.OCCURRENCE_OUTSIDE_SCHEDULE:
    case API_ERROR_CODE.OCCURRENCE_CANCELED:
    case API_ERROR_CODE.CANCEL_SCOPE_INVALID:
      return 409;
    default:
      return 500;
  }
};

const parseWeekOffset = (value: string | null) => {
  if (!value || !weekOffsetPattern.test(value)) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(-maxWeekOffset, Math.min(maxWeekOffset, parsed));
};

export async function GET(request: Request) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    const requestUrl = new URL(request.url);
    const weekOffset = parseWeekOffset(requestUrl.searchParams.get("weekOffset"));
    const listResult = await listChores({
      householdId: householdAccess.household.id,
      weekOffset,
      start: requestUrl.searchParams.get("start"),
      end: requestUrl.searchParams.get("end"),
    });

    return Response.json(
      {
        ok: true,
        timeZone: listResult.timeZone,
        rangeStart: listResult.rangeStart,
        rangeEnd: listResult.rangeEnd,
        chores: listResult.chores,
      },
      { headers: householdAccess.responseHeaders },
    );
  } catch (error) {
    if (error instanceof HouseholdNotFoundError) {
      return jsonError({
        headers: responseHeaders,
        status: 404,
        code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
        error: "Household not found",
      });
    }

    console.error("Failed to load chores", error);
    return jsonError({
      headers: responseHeaders,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to load chores",
    });
  }
}

export async function PATCH(request: Request) {
  let responseHeaders = new Headers();
  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }
    responseHeaders = householdAccess.responseHeaders;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateChorePatchPayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: 400,
        code: payloadValidation.code,
        error: payloadValidation.error,
      });
    }

    const result = await mutateChore({
      householdId: householdAccess.household.id,
      payload: payloadValidation.data,
    });
    if (!result.ok) {
      const { ok: _ok, ...errorPayload } = result;
      return jsonError({
        headers: householdAccess.responseHeaders,
        status: statusForChoreMutationCode(result.code),
        ...errorPayload,
      });
    }

    return Response.json(
      { ok: true, ...result.data },
      { headers: householdAccess.responseHeaders },
    );
  } catch (error) {
    if (error instanceof HouseholdNotFoundError) {
      return jsonError({
        headers: responseHeaders,
        status: 404,
        code: API_ERROR_CODE.HOUSEHOLD_NOT_FOUND,
        error: "Household not found",
      });
    }

    console.error("Failed to update chore", error);
    return jsonError({
      headers: responseHeaders,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to update chore",
    });
  }
}
