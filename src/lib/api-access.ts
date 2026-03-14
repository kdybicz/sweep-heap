import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { reconcileActiveHouseholdSession, resolveActiveHousehold } from "@/lib/services";
import {
  getSessionContext,
  type SessionContextOk,
  sessionErrorResponse,
} from "@/lib/session-context";

type ActiveHouseholdSummary = Extract<
  Awaited<ReturnType<typeof resolveActiveHousehold>>,
  { status: "resolved" }
>["household"];
type ActiveHouseholdResolution = Awaited<ReturnType<typeof resolveActiveHousehold>>;

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

type ApiSessionHouseholdResolutionAccess =
  | {
      ok: true;
      activeHousehold: ActiveHouseholdResolution;
      responseHeaders: Headers;
      sessionContext: SessionContextOk;
    }
  | ApiAccessFailure;

type ApiHouseholdAccess =
  | {
      ok: true;
      responseHeaders: Headers;
      sessionContext: SessionContextOk;
      household: ActiveHouseholdSummary;
    }
  | ApiAccessFailure;

type ReconciliationError = Error & {
  responseHeaders?: Headers;
};

const getErrorResponseHeaders = (error: unknown) => {
  const reconciliationError = error as ReconciliationError;
  return reconciliationError.responseHeaders instanceof Headers
    ? reconciliationError.responseHeaders
    : new Headers();
};

export const withResponseHeaders = (response: Response, headers: Headers) => {
  if ([...headers.entries()].length === 0) {
    return response;
  }

  const responseHeaders = new Headers(response.headers);
  for (const [key, value] of headers.entries()) {
    responseHeaders.append(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

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

export const requireApiSessionHouseholdResolution = async (
  requestHeaders?: Headers,
): Promise<ApiSessionHouseholdResolutionAccess> => {
  const sessionAccess = await requireApiSession();
  if (!sessionAccess.ok) {
    return sessionAccess;
  }

  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
    userId: sessionAccess.sessionContext.userId,
  });
  const responseHeaders = requestHeaders
    ? await (async () => {
        try {
          return await reconcileActiveHouseholdSession({
            requestHeaders,
            resolution: activeHousehold,
            sessionActiveHouseholdId: sessionAccess.sessionContext.sessionActiveHouseholdId,
          });
        } catch (error) {
          console.error("Failed to reconcile active household session", error);
          return getErrorResponseHeaders(error);
        }
      })()
    : new Headers();

  return {
    ok: true,
    activeHousehold,
    responseHeaders,
    sessionContext: sessionAccess.sessionContext,
  };
};

export const requireApiHousehold = async (
  requestHeaders?: Headers,
): Promise<ApiHouseholdAccess> => {
  const sessionResolutionAccess = await requireApiSessionHouseholdResolution(requestHeaders);
  if (!sessionResolutionAccess.ok) {
    return sessionResolutionAccess;
  }

  const { activeHousehold, responseHeaders, sessionContext } = sessionResolutionAccess;

  if (activeHousehold.status === "none") {
    return {
      ok: false,
      response: withResponseHeaders(householdRequiredResponse(), responseHeaders),
    };
  }

  if (activeHousehold.status === "selection-required") {
    return {
      ok: false,
      response: withResponseHeaders(householdSelectionRequiredResponse(), responseHeaders),
    };
  }

  return {
    ok: true,
    responseHeaders,
    sessionContext,
    household: activeHousehold.household,
  };
};

export const requireApiHouseholdAdmin = async (
  requestHeaders?: Headers,
): Promise<ApiHouseholdAccess> => {
  const householdAccess = await requireApiHousehold(requestHeaders);
  if (!householdAccess.ok) {
    return householdAccess;
  }

  if (!isHouseholdElevatedRole(householdAccess.household.role)) {
    return {
      ok: false,
      response: withResponseHeaders(forbiddenResponse(), householdAccess.responseHeaders),
    };
  }

  return householdAccess;
};
