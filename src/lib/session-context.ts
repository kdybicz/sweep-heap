import { getSession } from "@/auth";
import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { parsePositiveInt } from "@/lib/organization-api";

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

export type SessionContextOk = Extract<SessionContext, { ok: true }>;

const toSessionActiveHouseholdId = (value: unknown) => parsePositiveInt(value);

export const parseSessionContext = (
  session: Awaited<ReturnType<typeof getSession>>,
): SessionContext => {
  const sessionUser = session?.user;
  const rawUserId = sessionUser?.id;
  if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
    return {
      ok: false,
      userId: null,
      status: 401,
      code: API_ERROR_CODE.UNAUTHORIZED,
      error: "Unauthorized",
    };
  }

  const userId = parsePositiveInt(rawUserId);
  if (userId === null) {
    return {
      ok: false,
      userId: null,
      status: 400,
      code: API_ERROR_CODE.INVALID_USER,
      error: "Invalid user",
    };
  }

  return {
    ok: true,
    sessionActiveHouseholdId: toSessionActiveHouseholdId(session?.session?.activeOrganizationId),
    userId,
    sessionUserId: String(rawUserId),
    sessionUserName: typeof sessionUser?.name === "string" ? sessionUser.name : null,
    sessionUserEmail: typeof sessionUser?.email === "string" ? sessionUser.email : null,
  };
};

export const getSessionContext = async (): Promise<SessionContext> => {
  return parseSessionContext(await getSession());
};

export const getOptionalSessionContext = async (): Promise<SessionContextOk | null> => {
  const sessionContext = await getSessionContext();
  return sessionContext.ok ? sessionContext : null;
};

export const sessionErrorResponse = ({
  code,
  error,
  status,
}: Extract<SessionContext, { ok: false }>) => jsonError({ status, code, error });
