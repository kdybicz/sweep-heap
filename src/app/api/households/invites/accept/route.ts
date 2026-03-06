import { auth, getSession } from "@/auth";
import { hashHouseholdInviteSecret } from "@/lib/household-invite-secret";
import {
  isInvitationNotFoundError,
  isOtherHouseholdError,
  parsePositiveInt,
  toAuthApiErrorMessage,
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
    const payload = (await request.json().catch(() => null)) as {
      invitationId?: number | string;
      secret?: string;
    } | null;

    const invitationId = parsePositiveInt(payload?.invitationId);
    const secret = typeof payload?.secret === "string" ? payload.secret.trim() : "";
    if (invitationId === null || !secret) {
      return Response.json(
        { ok: false, error: "Invitation id and secret are required" },
        { status: 400 },
      );
    }

    const secretHash = hashHouseholdInviteSecret(secret);
    const invite = await getPendingHouseholdInviteByIdAndSecret({
      inviteId: invitationId,
      secretHash,
    });
    if (!invite) {
      return Response.json({ ok: false, error: "Invalid or expired invite" }, { status: 400 });
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
    const authApiErrorMessage = toAuthApiErrorMessage(error);
    if (isInvitationNotFoundError(authApiErrorMessage)) {
      return Response.json({ ok: false, error: "Invalid or expired invite" }, { status: 400 });
    }

    if (isOtherHouseholdError(authApiErrorMessage)) {
      return Response.json(
        { ok: false, error: "You already belong to another household" },
        { status: 409 },
      );
    }

    console.error("Failed to accept household invite", error);
    return Response.json(
      { ok: false, error: "Failed to accept household invite" },
      { status: 500 },
    );
  }
}
