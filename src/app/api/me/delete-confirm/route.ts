import { createHash } from "node:crypto";
import {
  consumeDeleteAccountToken,
  deleteUserById,
  extractUserIdFromDeleteAccountTokenIdentifier,
} from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    payload = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
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

  const userId = extractUserIdFromDeleteAccountTokenIdentifier(identifier);
  if (userId === null) {
    return Response.json({ ok: false, error: "Invalid token identifier" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const consumedIdentifier = await consumeDeleteAccountToken({ identifier, tokenHash });
  if (!consumedIdentifier) {
    return Response.json({ ok: false, error: "Invalid or expired token" }, { status: 400 });
  }

  const user = await deleteUserById({ userId });
  if (!user) {
    return Response.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    deletedUserId: user.id,
    deletedHouseholdIds: user.deletedHouseholdIds,
  });
}
