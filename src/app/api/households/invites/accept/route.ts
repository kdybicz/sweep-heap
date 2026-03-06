import { auth, getSession } from "@/auth";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { validateHouseholdInviteAcceptPayload } from "@/lib/api-payload-validation";
import { hashHouseholdInviteSecret } from "@/lib/household-invite-secret";
import { parseJsonObjectBody } from "@/lib/http";
import {
  isInvitationNotFoundError,
  isOtherHouseholdError,
  toAuthApiError,
} from "@/lib/organization-api";
import { getPendingHouseholdInviteByIdAndSecret } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const toInviteCompletePath = ({
  invitationId,
  secret,
}: {
  invitationId: number;
  secret: string;
}) => {
  const url = new URL("/api/households/invites/complete", "http://localhost");
  url.searchParams.set("invitationId", String(invitationId));
  url.searchParams.set("secret", secret);
  return `${url.pathname}${url.search}`;
};

const buildSignInRedirectUrl = ({
  email,
  invitationId,
  secret,
}: {
  email: string;
  invitationId: number;
  secret: string;
}) => {
  const url = new URL("/auth", "http://localhost");
  url.searchParams.set("email", email);
  url.searchParams.set(
    "callbackURL",
    toInviteCompletePath({
      invitationId,
      secret,
    }),
  );
  return `${url.pathname}${url.search}`;
};

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

    const secretHash = hashHouseholdInviteSecret(secret);
    const invite = await getPendingHouseholdInviteByIdAndSecret({
      inviteId: invitationId,
      secretHash,
    });
    if (!invite) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_INVITE,
        error: "Invalid or expired invite",
      });
    }

    const session = await getSession();
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!sessionEmail) {
      return Response.json({
        ok: true,
        redirectUrl: buildSignInRedirectUrl({
          email: invite.email,
          invitationId,
          secret,
        }),
      });
    }

    if (sessionEmail !== invite.email.trim().toLowerCase()) {
      return Response.json({
        ok: true,
        redirectUrl: buildSignInRedirectUrl({
          email: invite.email,
          invitationId,
          secret,
        }),
      });
    }

    await auth.api.acceptInvitation({
      body: {
        invitationId: String(invitationId),
      },
      headers: request.headers,
    });

    return Response.json({
      ok: true,
      redirectUrl: "/household",
      householdId: invite.householdId,
      householdName: invite.householdName,
    });
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_INVITE,
        error: "Invalid or expired invite",
      });
    }

    if (isOtherHouseholdError(authApiError)) {
      return jsonError({
        status: 409,
        code: API_ERROR_CODE.USER_IN_OTHER_HOUSEHOLD,
        error: "You already belong to another household",
      });
    }

    console.error("Failed to accept household invite", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to accept household invite",
    });
  }
}
