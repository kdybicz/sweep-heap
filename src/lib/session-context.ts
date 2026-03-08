import { getSession } from "@/auth";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";

export type SessionContext =
  | {
      ok: true;
      sessionActiveHouseholdId: number | null;
      userId: number;
      sessionUserId: string;
      sessionUserName: string | null;
      sessionUserEmail: string | null;
    }
  | {
      ok: false;
      userId: null;
      status: 400 | 401;
      code: "INVALID_USER" | "UNAUTHORIZED";
      error: "Invalid user" | "Unauthorized";
    };

export const getSessionContext = async (): Promise<SessionContext> => {
  const session = await getSession();
  const sessionUser = session?.user;
  const rawUserId = sessionUser?.id;
  if (!sessionUser || rawUserId === undefined || rawUserId === null) {
    return {
      ok: false,
      userId: null,
      status: 401,
      code: API_ERROR_CODE.UNAUTHORIZED,
      error: "Unauthorized",
    };
  }

  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) {
    return {
      ok: false,
      userId: null,
      status: 400,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    };
  }

  const rawSessionActiveHouseholdId = session?.session?.activeOrganizationId;
  const sessionActiveHouseholdId =
    rawSessionActiveHouseholdId === undefined ||
    rawSessionActiveHouseholdId === null ||
    rawSessionActiveHouseholdId === ""
      ? null
      : Number(rawSessionActiveHouseholdId);

  return {
    ok: true,
    sessionActiveHouseholdId:
      typeof sessionActiveHouseholdId === "number" &&
      Number.isInteger(sessionActiveHouseholdId) &&
      sessionActiveHouseholdId > 0
        ? sessionActiveHouseholdId
        : null,
    userId,
    sessionUserId: String(rawUserId),
    sessionUserName: typeof sessionUser.name === "string" ? sessionUser.name : null,
    sessionUserEmail: typeof sessionUser.email === "string" ? sessionUser.email : null,
  };
};

export const sessionErrorResponse = ({
  code,
  error,
  status,
}: Extract<SessionContext, { ok: false }>) => jsonError({ status, code, error });
