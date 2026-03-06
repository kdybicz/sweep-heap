import { requireApiHousehold } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { validateChorePatchPayload } from "@/lib/api-payload-validation";
import { parseJsonObjectBody } from "@/lib/http";
import { listChores, mutateChore } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weekOffsetPattern = /^-?\d+$/;
const maxWeekOffset = 520;

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
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const requestUrl = new URL(request.url);
    const weekOffset = parseWeekOffset(requestUrl.searchParams.get("weekOffset"));
    const listResult = await listChores({
      householdId: householdAccess.household.id,
      weekOffset,
      start: requestUrl.searchParams.get("start"),
      end: requestUrl.searchParams.get("end"),
    });

    return Response.json({
      ok: true,
      timeZone: listResult.timeZone,
      rangeStart: listResult.rangeStart,
      rangeEnd: listResult.rangeEnd,
      chores: listResult.chores,
    });
  } catch (error) {
    console.error("Failed to load chores", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to load chores",
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateChorePatchPayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const result = await mutateChore({
      householdId: householdAccess.household.id,
      payload: payloadValidation.data,
    });
    if (!result.ok) {
      return Response.json(result.body, { status: result.status });
    }

    return Response.json(result.body);
  } catch (error) {
    console.error("Failed to update chore", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to update chore",
    });
  }
}
