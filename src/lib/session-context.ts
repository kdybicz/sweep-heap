import { getSession } from "@/auth";

export type SessionContext =
  | {
      ok: true;
      userId: number;
      sessionUserId: string;
      sessionUserName: string | null;
      sessionUserEmail: string | null;
    }
  | {
      ok: false;
      userId: null;
      status: 400 | 401;
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
      error: "Unauthorized",
    };
  }

  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) {
    return {
      ok: false,
      userId: null,
      status: 400,
      error: "Invalid user",
    };
  }

  return {
    ok: true,
    userId,
    sessionUserId: String(rawUserId),
    sessionUserName: typeof sessionUser.name === "string" ? sessionUser.name : null,
    sessionUserEmail: typeof sessionUser.email === "string" ? sessionUser.email : null,
  };
};

export const sessionErrorResponse = ({ error, status }: Extract<SessionContext, { ok: false }>) =>
  Response.json(
    {
      ok: false,
      error,
    },
    {
      status,
    },
  );
