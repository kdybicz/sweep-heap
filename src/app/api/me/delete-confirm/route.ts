import { createHash } from "node:crypto";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import {
  consumeDeleteAccountToken,
  deleteUserById,
  extractUserIdFromDeleteAccountTokenIdentifier,
} from "@/lib/repositories";

export const dynamic = "force-dynamic";

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

    const identifier = typeof payload.identifier === "string" ? payload.identifier.trim() : "";
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!identifier || !token) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        error: "Identifier and token are required",
      });
    }

    const userId = extractUserIdFromDeleteAccountTokenIdentifier(identifier);
    if (userId === null) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.INVALID_TOKEN_IDENTIFIER,
        error: "Invalid token identifier",
      });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const consumedIdentifier = await consumeDeleteAccountToken({ identifier, tokenHash });
    if (!consumedIdentifier) {
      return jsonError({
        status: 400,
        code: API_ERROR_CODE.DELETE_TOKEN_INVALID,
        error: "Invalid or expired token",
      });
    }

    const user = await deleteUserById({ userId });
    if (!user) {
      return jsonError({
        status: 404,
        code: API_ERROR_CODE.USER_NOT_FOUND,
        error: "User not found",
      });
    }

    return Response.json({
      ok: true,
      deletedUserId: user.id,
      deletedHouseholdIds: user.deletedHouseholdIds,
    });
  } catch (error) {
    console.error("Failed to confirm account deletion", error);
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Failed to confirm account deletion",
    });
  }
}
