import { createHash } from "node:crypto";

import { getSession } from "@/auth";
import { acceptHouseholdInvite } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const redirectTo = ({
  error,
  identifier,
  request,
  token,
}: {
  error: "invalid" | "other-household" | "sign-in" | "unexpected";
  identifier: string;
  request: Request;
  token: string;
}) => {
  const url = new URL("/household/invite", request.url);
  url.searchParams.set("identifier", identifier);
  url.searchParams.set("token", token);
  url.searchParams.set("error", error);
  return url;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const identifier = url.searchParams.get("identifier")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!identifier || !token) {
    return Response.redirect(new URL("/auth", request.url), 302);
  }

  const session = await getSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const sessionUserId = Number(session?.user?.id);
  if (!sessionEmail || !Number.isFinite(sessionUserId)) {
    return Response.redirect(redirectTo({ error: "sign-in", identifier, request, token }), 302);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const acceptResult = await acceptHouseholdInvite({
    email: sessionEmail,
    identifier,
    tokenHash,
    userId: sessionUserId,
  });

  if (acceptResult.status === "accepted") {
    return Response.redirect(new URL("/household", request.url), 302);
  }

  if (acceptResult.status === "invalid_or_expired") {
    return Response.redirect(redirectTo({ error: "invalid", identifier, request, token }), 302);
  }

  if (acceptResult.status === "belongs_to_other_household") {
    return Response.redirect(
      redirectTo({ error: "other-household", identifier, request, token }),
      302,
    );
  }

  if (acceptResult.status === "email_mismatch") {
    return Response.redirect(redirectTo({ error: "sign-in", identifier, request, token }), 302);
  }

  return Response.redirect(redirectTo({ error: "unexpected", identifier, request, token }), 302);
}
