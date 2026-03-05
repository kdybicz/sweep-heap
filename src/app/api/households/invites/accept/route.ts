import { createHash, randomBytes } from "node:crypto";

import { auth, getSession } from "@/auth";
import { getAppOrigin, parseJsonObjectBody } from "@/lib/http";
import { acceptHouseholdInvite, getValidHouseholdInvite } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const inviteSigninTokenExpiryMs = 10 * 60 * 1000;

const buildAuthRedirectUrl = ({
  identifier,
  request,
  token,
  verificationToken,
}: {
  identifier: string;
  request: Request;
  token: string;
  verificationToken: string;
}) => {
  const appOrigin = getAppOrigin(request);
  const callbackUrl = new URL("/api/households/invites/complete", appOrigin);
  callbackUrl.searchParams.set("identifier", identifier);
  callbackUrl.searchParams.set("token", token);

  const verifyUrl = new URL("/api/auth/magic-link/verify", appOrigin);
  verifyUrl.searchParams.set("token", verificationToken);
  verifyUrl.searchParams.set("callbackURL", callbackUrl.pathname + callbackUrl.search);

  return verifyUrl.toString();
};

export async function POST(request: Request) {
  try {
    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const identifier = typeof payload.identifier === "string" ? payload.identifier.trim() : "";
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!identifier || !token) {
      return Response.json(
        { ok: false, error: "Identifier and token are required" },
        { status: 400 },
      );
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invite = await getValidHouseholdInvite({ identifier, tokenHash });
    if (!invite) {
      return Response.json({ ok: false, error: "Invalid or expired invite" }, { status: 400 });
    }

    const session = await getSession();
    const sessionUserId = Number(session?.user?.id);
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
    const hasActiveSession = Number.isFinite(sessionUserId) && Boolean(sessionEmail);

    if (hasActiveSession) {
      const acceptResult = await acceptHouseholdInvite({
        email: sessionEmail,
        identifier,
        tokenHash,
        userId: sessionUserId,
      });

      if (acceptResult.status === "invalid_or_expired") {
        return Response.json({ ok: false, error: "Invalid or expired invite" }, { status: 400 });
      }

      if (acceptResult.status === "belongs_to_other_household") {
        return Response.json(
          { ok: false, error: "You already belong to another household" },
          { status: 409 },
        );
      }

      if (acceptResult.status === "accepted") {
        return Response.json({
          ok: true,
          redirectUrl: "/household",
          householdId: acceptResult.householdId,
          householdName: acceptResult.householdName,
          wasAlreadyMember: acceptResult.wasAlreadyMember,
        });
      }
    }

    const verificationToken = randomBytes(32).toString("base64url");
    const authContext = await auth.$context;
    await authContext.internalAdapter.createVerificationValue({
      identifier: verificationToken,
      value: JSON.stringify({ email: invite.email, name: "" }),
      expiresAt: new Date(Date.now() + inviteSigninTokenExpiryMs),
    });

    return Response.json({
      ok: true,
      redirectUrl: buildAuthRedirectUrl({
        identifier,
        request,
        token,
        verificationToken,
      }),
    });
  } catch (error) {
    console.error("Failed to accept household invite", error);
    return Response.json(
      { ok: false, error: "Failed to accept household invite" },
      { status: 500 },
    );
  }
}
