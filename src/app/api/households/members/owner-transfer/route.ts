import { requireApiHouseholdAdmin } from "@/lib/api-access";
import { API_ERROR_CODE, type ApiErrorCode, jsonError } from "@/lib/api-error";
import { validateHouseholdOwnerTransferPayload } from "@/lib/api-payload-validation";
import { parseJsonObjectBody } from "@/lib/http";
import { transferHouseholdOwnership } from "@/lib/services/household-members-service";

export const dynamic = "force-dynamic";

const jsonServiceFailure = ({
  headers,
  result,
}: {
  headers: Headers;
  result: { ok: false; status: number; code: ApiErrorCode; error: string } & Record<
    string,
    unknown
  >;
}) => {
  const { ok: _ok, status, ...payload } = result;
  return jsonError({ headers, status, ...payload });
};

export async function POST(request: Request) {
  let responseHeaders = new Headers();
  try {
    const adminAccess = await requireApiHouseholdAdmin(request.headers);
    if (!adminAccess.ok) {
      return adminAccess.response;
    }
    responseHeaders = adminAccess.responseHeaders;

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdOwnerTransferPayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        headers: adminAccess.responseHeaders,
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { userId: targetUserId } = payloadValidation.data;
    const result = await transferHouseholdOwnership({
      actorRole: household.role,
      actorUserId: sessionContext.userId,
      householdId: household.id,
      requestHeaders: request.headers,
      targetUserId,
    });
    if (!result.ok) {
      return jsonServiceFailure({ headers: adminAccess.responseHeaders, result });
    }

    return Response.json({ ok: true, ...result.data }, { headers: adminAccess.responseHeaders });
  } catch (error) {
    console.error("Failed to transfer household ownership", error);
    return jsonError({
      headers: responseHeaders,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to transfer household ownership",
    });
  }
}
