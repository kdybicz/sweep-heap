import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { resolveActiveHousehold } from "@/lib/services";
import { getSessionContext, sessionErrorResponse } from "@/lib/session-context";

type SessionContextOk = Extract<Awaited<ReturnType<typeof getSessionContext>>, { ok: true }>;
type ActiveHouseholdSummary = Extract<
  Awaited<ReturnType<typeof resolveActiveHousehold>>,
  { status: "resolved" }
>["household"];

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
  jsonError({
    status: 403,
    code: API_ERROR_CODE.HOUSEHOLD_REQUIRED,
    error: "Household required",
  });

const householdSelectionRequiredResponse = () =>
  jsonError({
    status: 409,
    code: API_ERROR_CODE.HOUSEHOLD_SELECTION_REQUIRED,
    error: "Active household selection required",
  });

const forbiddenResponse = () =>
  jsonError({
    status: 403,
    code: API_ERROR_CODE.FORBIDDEN,
    error: "Forbidden",
  });

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

  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
    userId: sessionAccess.sessionContext.userId,
  });
  if (activeHousehold.status === "none") {
    return {
      ok: false,
      response: householdRequiredResponse(),
    };
  }

  if (activeHousehold.status === "selection-required") {
    return {
      ok: false,
      response: householdSelectionRequiredResponse(),
    };
  }

  return {
    ok: true,
    sessionContext: sessionAccess.sessionContext,
    household: activeHousehold.household,
  };
};

export const requireApiHouseholdAdmin = async (): Promise<ApiHouseholdAccess> => {
  const householdAccess = await requireApiHousehold();
  if (!householdAccess.ok) {
    return householdAccess;
  }

  if (!isHouseholdElevatedRole(householdAccess.household.role)) {
    return {
      ok: false,
      response: forbiddenResponse(),
    };
  }

  return householdAccess;
};
