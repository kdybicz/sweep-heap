import { createHash, randomBytes } from "node:crypto";
import { requireApiSession } from "@/lib/api-access";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { sendDeleteAccountConfirmationEmail } from "@/lib/delete-account-email";
import { getAppOrigin } from "@/lib/http";
import { buildDeleteAccountTokenIdentifier, createDeleteAccountToken } from "@/lib/repositories";
import { listAccountDeletionBlockingHouseholds } from "@/lib/services/ownership-guard-service";

export const dynamic = "force-dynamic";

const tokenExpiryInMinutes = 30;

export async function POST(request: Request) {
  try {
    const sessionAccess = await requireApiSession();
    if (!sessionAccess.ok) {
      return sessionAccess.response;
    }

    const email = sessionAccess.sessionContext.sessionUserEmail?.trim();
    if (!email) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.EMAIL_REQUIRED,
        error: "Email is required to confirm account deletion",
      });
    }

    const blockingHouseholds = await listAccountDeletionBlockingHouseholds(
      sessionAccess.sessionContext.userId,
    );
    if (blockingHouseholds.length > 0) {
      return jsonError({
        status: 409,
        code: API_ERROR_CODE.ACCOUNT_DELETE_REQUIRES_SOLO_OWNERSHIP,
        error: "Remove other active members from owned households before deleting your account",
        blockingHouseholds,
      });
    }

    const appOrigin = getAppOrigin(request);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const identifier = buildDeleteAccountTokenIdentifier({
      userId: sessionAccess.sessionContext.userId,
      nonce: randomBytes(12).toString("base64url"),
    });
    const expiresAt = new Date(Date.now() + tokenExpiryInMinutes * 60 * 1000);

    await createDeleteAccountToken({
      userId: sessionAccess.sessionContext.userId,
      identifier,
      tokenHash,
      expiresAt,
    });

    const confirmationUrl = new URL("/user/delete/confirm", appOrigin);
    confirmationUrl.searchParams.set("identifier", identifier);
    confirmationUrl.searchParams.set("token", token);

    try {
      await sendDeleteAccountConfirmationEmail({
        to: email,
        confirmationUrl: confirmationUrl.toString(),
        expiresInMinutes: tokenExpiryInMinutes,
      });
    } catch {
      return jsonError({
        status: 500,
        code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
        error: "Failed to send confirmation email",
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to create delete account request", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to create delete account request",
    });
  }
}
