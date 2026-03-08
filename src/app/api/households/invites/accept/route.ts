import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { validateHouseholdInviteAcceptPayload } from "@/lib/api-payload-validation";
import { parseJsonObjectBody } from "@/lib/http";
import {
  acceptHouseholdInvite,
  buildHouseholdInviteSignInRedirectUrl,
  getPendingHouseholdInvite,
  hasMatchingHouseholdInviteSession,
} from "@/lib/services/household-invite-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_JSON_BODY,
        error: "Invalid JSON body",
      });
    }

    const payloadValidation = validateHouseholdInviteAcceptPayload(payload);
    if (!payloadValidation.ok) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: payloadValidation.error,
      });
    }

    const { invitationId, secret } = payloadValidation.data;

    const invite = await getPendingHouseholdInvite({ invitationId, secret });
    if (!invite) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_INVITE,
        error: "Invalid or expired invite",
      });
    }

    const hasMatchingSession = await hasMatchingHouseholdInviteSession(invite.email);
    if (!hasMatchingSession) {
      return Response.json({
        ok: true,
        redirectUrl: buildHouseholdInviteSignInRedirectUrl({
          email: invite.email,
          invitationId,
          secret,
        }),
      });
    }

    const acceptance = await acceptHouseholdInvite({
      householdId: invite.householdId,
      invitationId,
      requestHeaders: request.headers,
    });
    if (!acceptance.ok) {
      if (acceptance.reason === "invalid") {
        return jsonError({
          status: 400,
          code: API_ERROR_CODE.INVALID_INVITE,
          error: "Invalid or expired invite",
        });
      }

      if (acceptance.reason === "other-household") {
        return jsonError({
          status: 409,
          code: API_ERROR_CODE.USER_IN_OTHER_HOUSEHOLD,
          error: "You already belong to another household",
        });
      }

      if (acceptance.reason === "recipient-mismatch") {
        return Response.json({
          ok: true,
          redirectUrl: buildHouseholdInviteSignInRedirectUrl({
            email: invite.email,
            invitationId,
            secret,
          }),
        });
      }

      if (acceptance.reason === "unexpected") {
        throw acceptance.error;
      }

      throw new Error("Unhandled household invite acceptance result");
    }

    return Response.json(
      {
        ok: true,
        redirectUrl: "/household",
        householdId: invite.householdId,
        householdName: invite.householdName,
      },
      { headers: acceptance.responseHeaders },
    );
  } catch (error) {
    console.error("Failed to accept household invite", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to accept household invite",
    });
  }
}
