import { toHouseholdInvitePagePath } from "@/lib/household-invite-paths";
import { parsePositiveInt } from "@/lib/organization-api";
import {
  acceptHouseholdInvite,
  getHouseholdInviteSessionEmail,
  getPendingHouseholdInvite,
} from "@/lib/services/household-invite-service";

export const dynamic = "force-dynamic";

const redirectToInvitePage = ({
  error,
  invitationId,
  request,
  secret,
}: {
  error: "invalid" | "sign-in" | "unexpected";
  invitationId: number;
  request: Request;
  secret: string;
}) =>
  Response.redirect(
    new URL(
      toHouseholdInvitePagePath({
        error,
        invitationId,
        secret,
      }),
      request.url,
    ),
    302,
  );

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
    return redirectToInvitePage({
      error: "sign-in",
      invitationId: numericInvitationId,
      request,
      secret,
    });
  }

  const invite = await getPendingHouseholdInvite({
    invitationId: numericInvitationId,
    secret,
  });
  if (!invite) {
    return redirectToInvitePage({
      error: "invalid",
      invitationId: numericInvitationId,
      request,
      secret,
    });
  }

  if (sessionEmail !== invite.email.trim().toLowerCase()) {
    return redirectToInvitePage({
      error: "sign-in",
      invitationId: numericInvitationId,
      request,
      secret,
    });
  }

  const acceptance = await acceptHouseholdInvite({
    householdId: invite.householdId,
    invitationId: numericInvitationId,
    requestHeaders: request.headers,
  });
  if (acceptance.ok) {
    const headers = new Headers(acceptance.responseHeaders);
    headers.set("location", new URL(acceptance.nextPath, request.url).toString());
    return new Response(null, { status: 302, headers });
  }

  if (acceptance.reason === "invalid") {
    return redirectToInvitePage({
      error: "invalid",
      invitationId: numericInvitationId,
      request,
      secret,
    });
  }

  if (acceptance.reason === "recipient-mismatch") {
    return redirectToInvitePage({
      error: "sign-in",
      invitationId: numericInvitationId,
      request,
      secret,
    });
  }

  return redirectToInvitePage({
    error: "unexpected",
    invitationId: numericInvitationId,
    request,
    secret,
  });
}
