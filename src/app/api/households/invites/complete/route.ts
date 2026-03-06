import { auth, getSession } from "@/auth";
import { hashHouseholdInviteSecret } from "@/lib/household-invite-secret";
import {
  isInvitationNotFoundError,
  isInviteRecipientMismatchError,
  isOtherHouseholdError,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import { getPendingHouseholdInviteByIdAndSecret } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const redirectTo = ({
  error,
  invitationId,
  request,
  secret,
}: {
  error: "invalid" | "other-household" | "sign-in" | "unexpected";
  invitationId: string;
  request: Request;
  secret: string;
}) => {
  const url = new URL("/household/invite", request.url);
  url.searchParams.set("invitationId", invitationId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("error", error);
  return url;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const invitationId = url.searchParams.get("invitationId")?.trim() ?? "";
  const secret = url.searchParams.get("secret")?.trim() ?? "";
  const numericInvitationId = parsePositiveInt(invitationId);
  if (numericInvitationId === null || !secret) {
    return Response.redirect(new URL("/auth", request.url), 302);
  }

  const session = await getSession();
  if (!session?.user?.email) {
    return Response.redirect(
      redirectTo({
        error: "sign-in",
        invitationId: String(numericInvitationId),
        request,
        secret,
      }),
      302,
    );
  }

  const invite = await getPendingHouseholdInviteByIdAndSecret({
    inviteId: numericInvitationId,
    secretHash: hashHouseholdInviteSecret(secret),
  });
  if (!invite) {
    return Response.redirect(
      redirectTo({
        error: "invalid",
        invitationId: String(numericInvitationId),
        request,
        secret,
      }),
      302,
    );
  }

  const sessionEmail = session.user.email.trim().toLowerCase();
  if (sessionEmail !== invite.email.trim().toLowerCase()) {
    return Response.redirect(
      redirectTo({
        error: "sign-in",
        invitationId: String(numericInvitationId),
        request,
        secret,
      }),
      302,
    );
  }

  try {
    await auth.api.acceptInvitation({
      body: {
        invitationId: String(numericInvitationId),
      },
      headers: request.headers,
    });

    return Response.redirect(new URL("/household", request.url), 302);
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return Response.redirect(
        redirectTo({
          error: "invalid",
          invitationId: String(numericInvitationId),
          request,
          secret,
        }),
        302,
      );
    }

    if (isOtherHouseholdError(authApiError)) {
      return Response.redirect(
        redirectTo({
          error: "other-household",
          invitationId: String(numericInvitationId),
          request,
          secret,
        }),
        302,
      );
    }

    if (isInviteRecipientMismatchError(authApiError)) {
      return Response.redirect(
        redirectTo({
          error: "sign-in",
          invitationId: String(numericInvitationId),
          request,
          secret,
        }),
        302,
      );
    }

    return Response.redirect(
      redirectTo({
        error: "unexpected",
        invitationId: String(numericInvitationId),
        request,
        secret,
      }),
      302,
    );
  }
}
