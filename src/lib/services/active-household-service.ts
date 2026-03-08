import { auth } from "@/auth";
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
  const responseHeaders = new Headers();

  if (resolution.status === "resolved" && resolution.source === "session") {
    return responseHeaders;
  }

  if (resolution.status === "resolved" && resolution.source === "fallback") {
    const setActiveResponse = await auth.api.setActiveOrganization({
      asResponse: true,
      body: {
        organizationId: String(resolution.household.id),
      },
      headers: requestHeaders,
    });

    for (const [key, value] of setActiveResponse.headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
        responseHeaders.append(key, value);
      }
    }

    return responseHeaders;
  }

  if (sessionActiveHouseholdId === null) {
    return responseHeaders;
  }

  const clearActiveResponse = await auth.api.setActiveOrganization({
    asResponse: true,
    body: {
      organizationId: null,
    },
    headers: requestHeaders,
  });

  for (const [key, value] of clearActiveResponse.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      responseHeaders.append(key, value);
    }
  }

  return responseHeaders;
};
