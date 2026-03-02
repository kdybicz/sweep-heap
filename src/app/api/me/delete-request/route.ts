import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { sendDeleteAccountConfirmationEmail } from "@/lib/delete-account-email";
import { buildDeleteAccountTokenIdentifier, createDeleteAccountToken } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const tokenExpiryInMinutes = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
  }

  const email = session.user.email?.trim();
  if (!email) {
    return Response.json(
      { ok: false, error: "Email is required to confirm account deletion" },
      { status: 400 },
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const identifier = buildDeleteAccountTokenIdentifier({
    userId,
    nonce: randomBytes(12).toString("base64url"),
  });
  const expiresAt = new Date(Date.now() + tokenExpiryInMinutes * 60 * 1000);

  await createDeleteAccountToken({
    userId,
    identifier,
    tokenHash,
    expiresAt,
  });

  const confirmationUrl = new URL("/user/delete/confirm", request.url);
  confirmationUrl.searchParams.set("identifier", identifier);
  confirmationUrl.searchParams.set("token", token);

  try {
    await sendDeleteAccountConfirmationEmail({
      to: email,
      confirmationUrl: confirmationUrl.toString(),
      expiresInMinutes: tokenExpiryInMinutes,
    });
  } catch {
    return Response.json(
      { ok: false, error: "Failed to send confirmation email" },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
