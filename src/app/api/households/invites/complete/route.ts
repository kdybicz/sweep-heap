import { parsePositiveInt } from "@/lib/organization-api";
import {
  acceptHouseholdInvite,
  getHouseholdInviteSessionEmail,
  getPendingHouseholdInvite,
} from "@/lib/services/household-invite-service";

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

  const sessionEmail = await getHouseholdInviteSessionEmail();
  if (!sessionEmail) {
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

  const invite = await getPendingHouseholdInvite({
    invitationId: numericInvitationId,
    secret,
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

  const acceptance = await acceptHouseholdInvite({
    householdId: invite.householdId,
    invitationId: numericInvitationId,
    requestHeaders: request.headers,
  });
  if (acceptance.ok) {
    const headers = new Headers(acceptance.responseHeaders);
    headers.set("location", new URL("/household", request.url).toString());
    return new Response(null, { status: 302, headers });
  }

  if (acceptance.reason === "invalid") {
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

  if (acceptance.reason === "other-household") {
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

  if (acceptance.reason === "recipient-mismatch") {
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
