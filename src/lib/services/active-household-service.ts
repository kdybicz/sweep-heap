import { auth } from "@/auth";
import { assertOkResponse, copySetCookieHeaders, hasSetCookieHeaders } from "@/lib/auth-response";
import { getHouseholdSummaryForUser, listActiveHouseholdsForUser } from "@/lib/repositories";

type ActiveHouseholdSummary = NonNullable<Awaited<ReturnType<typeof getHouseholdSummaryForUser>>>;

export type ActiveHouseholdResolution =
  | {
      status: "resolved";
      household: ActiveHouseholdSummary;
      source: "session" | "fallback";
    }
  | {
      status: "none";
    }
  | {
      status: "selection-required";
      households: ActiveHouseholdSummary[];
    };

export type ActiveHouseholdPostMembershipMutation = {
  activeHouseholdActivated: boolean;
  nextPath: "/household" | "/household/select" | "/household/setup";
  resolution: ActiveHouseholdResolution;
  responseHeaders: Headers;
};

type ActiveHouseholdReconciliationError = Error & {
  responseHeaders?: Headers;
};

const nextPathForResolution = (resolution: ActiveHouseholdResolution) => {
  if (resolution.status === "resolved") {
    return "/household" as const;
  }

  if (resolution.status === "selection-required") {
    return "/household/select" as const;
  }

  return "/household/setup" as const;
};

const withResponseHeaders = (error: unknown, responseHeaders: Headers) => {
  const wrappedError: ActiveHouseholdReconciliationError =
    error instanceof Error
      ? (error as ActiveHouseholdReconciliationError)
      : new Error(String(error));
  wrappedError.responseHeaders = responseHeaders;
  return wrappedError;
};

export const resolveActiveHousehold = async ({
  sessionActiveHouseholdId,
  userId,
}: {
  sessionActiveHouseholdId: number | null;
  userId: number;
}): Promise<ActiveHouseholdResolution> => {
  if (sessionActiveHouseholdId !== null) {
    const activeHousehold = await getHouseholdSummaryForUser({
      householdId: sessionActiveHouseholdId,
      userId,
    });
    if (activeHousehold) {
      return {
        status: "resolved",
        household: activeHousehold,
        source: "session",
      };
    }
  }

  const households = await listActiveHouseholdsForUser(userId);
  if (households.length === 0) {
    return {
      status: "none",
    };
  }

  if (households.length === 1) {
    return {
      status: "resolved",
      household: households[0],
      source: "fallback",
    };
  }

  return {
    status: "selection-required",
    households,
  };
};

export const reconcileActiveHouseholdSession = async ({
  requestHeaders,
  resolution,
  sessionActiveHouseholdId,
}: {
  requestHeaders: Headers;
  resolution: ActiveHouseholdResolution;
  sessionActiveHouseholdId: number | null;
}) => {
  let responseHeaders = new Headers();

  if (resolution.status === "resolved" && resolution.source === "session") {
    return responseHeaders;
  }

  if (resolution.status === "resolved" && resolution.source === "fallback") {
    try {
      const setActiveResponse = await auth.api.setActiveOrganization({
        asResponse: true,
        body: {
          organizationId: String(resolution.household.id),
        },
        headers: requestHeaders,
      });

      responseHeaders = copySetCookieHeaders(setActiveResponse.headers);

      assertOkResponse(setActiveResponse, "Activate fallback household failed");
    } catch (error) {
      throw withResponseHeaders(error, responseHeaders);
    }

    return responseHeaders;
  }

  if (sessionActiveHouseholdId === null) {
    return responseHeaders;
  }

  try {
    const clearActiveResponse = await auth.api.setActiveOrganization({
      asResponse: true,
      body: {
        organizationId: null,
      },
      headers: requestHeaders,
    });

    responseHeaders = copySetCookieHeaders(clearActiveResponse.headers);

    assertOkResponse(clearActiveResponse, "Clear stale active household failed");
  } catch (error) {
    throw withResponseHeaders(error, responseHeaders);
  }

  return responseHeaders;
};

export const reconcileActiveHouseholdAfterMembershipMutation = async ({
  requestHeaders,
  sessionActiveHouseholdId,
  userId,
}: {
  requestHeaders: Headers;
  sessionActiveHouseholdId: number | null;
  userId: number;
}): Promise<ActiveHouseholdPostMembershipMutation> => {
  const resolution = await resolveActiveHousehold({
    sessionActiveHouseholdId,
    userId,
  });

  let responseHeaders = new Headers();
  let reconciliationSucceeded = true;
  try {
    responseHeaders = await reconcileActiveHouseholdSession({
      requestHeaders,
      resolution,
      sessionActiveHouseholdId,
    });
  } catch (error) {
    reconciliationSucceeded = false;
    const reconciliationError = error as ActiveHouseholdReconciliationError;
    if (reconciliationError.responseHeaders instanceof Headers) {
      responseHeaders = reconciliationError.responseHeaders;
    }
    console.error("Failed to reconcile active household after membership mutation", error);
  }

  return {
    activeHouseholdActivated:
      reconciliationSucceeded &&
      resolution.status === "resolved" &&
      resolution.source === "fallback" &&
      hasSetCookieHeaders(responseHeaders),
    nextPath: nextPathForResolution(resolution),
    resolution,
    responseHeaders,
  };
};
