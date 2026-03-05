import { getActiveHouseholdSummary } from "@/lib/repositories";
import { getSessionContext, sessionErrorResponse } from "@/lib/session-context";

type SessionContextOk = Extract<Awaited<ReturnType<typeof getSessionContext>>, { ok: true }>;
type ActiveHouseholdSummary = NonNullable<Awaited<ReturnType<typeof getActiveHouseholdSummary>>>;

type ApiAccessFailure = {
  ok: false;
  response: Response;
};

type ApiSessionAccess =
  | {
      ok: true;
      sessionContext: SessionContextOk;
    }
  | ApiAccessFailure;

type ApiHouseholdAccess =
  | {
      ok: true;
      sessionContext: SessionContextOk;
      household: ActiveHouseholdSummary;
    }
  | ApiAccessFailure;

const householdRequiredResponse = () =>
  Response.json({ ok: false, error: "Household required" }, { status: 403 });

const forbiddenResponse = () => Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

export const requireApiSession = async (): Promise<ApiSessionAccess> => {
  const sessionContext = await getSessionContext();
  if (!sessionContext.ok) {
    return {
      ok: false,
      response: sessionErrorResponse(sessionContext),
    };
  }

  return {
    ok: true,
    sessionContext,
  };
};

export const requireApiHousehold = async (): Promise<ApiHouseholdAccess> => {
  const sessionAccess = await requireApiSession();
  if (!sessionAccess.ok) {
    return sessionAccess;
  }

  const household = await getActiveHouseholdSummary(sessionAccess.sessionContext.userId);
  if (!household) {
    return {
      ok: false,
      response: householdRequiredResponse(),
    };
  }

  return {
    ok: true,
    sessionContext: sessionAccess.sessionContext,
    household,
  };
};

export const requireApiHouseholdAdmin = async (): Promise<ApiHouseholdAccess> => {
  const householdAccess = await requireApiHousehold();
  if (!householdAccess.ok) {
    return householdAccess;
  }

  if (householdAccess.household.role !== "admin") {
    return {
      ok: false,
      response: forbiddenResponse(),
    };
  }

  return householdAccess;
};
