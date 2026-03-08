import { createHash } from "node:crypto";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parseJsonObjectBody } from "@/lib/http";
import { deleteUserById, extractUserIdFromDeleteAccountTokenIdentifier } from "@/lib/repositories";

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
    const user = await deleteUserById({
      deleteAccountToken: {
        identifier,
        tokenHash,
      },
      userId,
    });
    if (!user.ok) {
      if (user.reason === "invalid-token") {
        return jsonError({
          status: 400,
          code: API_ERROR_CODE.DELETE_TOKEN_INVALID,
          error: "Invalid or expired token",
        });
      }

      if (user.reason === "ownership-conflict") {
        return jsonError({
          status: 409,
          code: API_ERROR_CODE.ACCOUNT_DELETE_REQUIRES_SOLO_OWNERSHIP,
          error: "Remove other active members from owned households before deleting your account",
          blockingHouseholds: user.blockingHouseholds,
        });
      }

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
