import { auth } from "@/auth";
import { requireApiHousehold } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { appendSetCookieHeaders, assertOkResponse } from "@/lib/auth-response";
import { isLastOwnerError, toAuthApiError } from "@/lib/organization-api";
import { reconcileActiveHouseholdAfterMembershipMutation } from "@/lib/services/active-household-service";
import { withHouseholdMutationLock } from "@/lib/services/ownership-guard-service";

export const dynamic = "force-dynamic";

const handleUnexpectedError = (responseHeaders: Headers, error: unknown) => {
  console.error("Failed to leave household", error);
  return jsonError({
    headers: responseHeaders,
    status: 500,
    code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
    error: "Failed to leave household",
  });
};

export async function POST(request: Request) {
  let responseHeaders = new Headers();

  try {
    const householdAccess = await requireApiHousehold(request.headers);
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    responseHeaders = new Headers(householdAccess.responseHeaders);

    const { household, sessionContext } = householdAccess;
    if (household.role === "owner") {
      return jsonError({
        headers: responseHeaders,
        status: 403,
        code: API_ERROR_CODE.FORBIDDEN,
        error: "Transfer ownership before leaving this household",
      });
    }

    return await withHouseholdMutationLock({
      householdId: household.id,
      task: async () => {
        try {
          const leaveResponse = await auth.api.leaveOrganization({
            asResponse: true,
            body: {
              organizationId: String(household.id),
            },
            headers: request.headers,
          });
          appendSetCookieHeaders(responseHeaders, leaveResponse.headers);
          assertOkResponse(leaveResponse, "Leave household failed");
        } catch (error) {
          const authApiError = toAuthApiError(error);
          if (isLastOwnerError(authApiError)) {
            return jsonError({
              headers: responseHeaders,
              status: 409,
              code: API_ERROR_CODE.LAST_OWNER_REQUIRED,
              error: "At least one household owner must remain",
            });
          }

          throw error;
        }

        let nextPath = "/household/setup";
        let activeHouseholdActivated = false;
        try {
          const mutationResult = await reconcileActiveHouseholdAfterMembershipMutation({
            requestHeaders: request.headers,
            sessionActiveHouseholdId: sessionContext.sessionActiveHouseholdId,
            userId: sessionContext.userId,
          });
          appendSetCookieHeaders(responseHeaders, mutationResult.responseHeaders);
          nextPath = mutationResult.nextPath;
          activeHouseholdActivated = mutationResult.activeHouseholdActivated;
        } catch (error) {
          console.error("Failed to reconcile active household after leave", error);
          nextPath = "/household/select";
        }

        return Response.json(
          {
            ok: true,
            activeHouseholdActivated,
            leftHouseholdId: household.id,
            nextPath,
          },
          { headers: responseHeaders },
        );
      },
    });
  } catch (error) {
    return handleUnexpectedError(responseHeaders, error);
  }
}
