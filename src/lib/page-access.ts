import { redirect } from "next/navigation";

import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { listActiveHouseholdsForUser } from "@/lib/repositories";
import { resolveActiveHousehold } from "@/lib/services";
import {
  getOptionalSessionContext,
  getSessionContext,
  type SessionContextOk,
} from "@/lib/session-context";

type PageSessionAccess = Omit<SessionContextOk, "ok">;
type PageHouseholdResolution = Awaited<ReturnType<typeof resolveActiveHousehold>>;
type PageSelectionAccess = PageSessionAccess & {
  householdResolution: Exclude<PageHouseholdResolution, { status: "none" }>;
  households: Awaited<ReturnType<typeof listActiveHouseholdsForUser>>;
};

const redirectToAuth = (): never => {
  redirect("/auth");
};

const redirectForHouseholdResolution = (householdResolution: PageHouseholdResolution): never => {
  redirect(
    householdResolution.status === "selection-required" ? "/household/select" : "/household/setup",
  );
};

const getPageHouseholdResolution = async (
  access: Pick<PageSessionAccess, "sessionActiveHouseholdId" | "userId">,
): Promise<PageHouseholdResolution> =>
  resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });

export const requirePageSessionUser = async (): Promise<PageSessionAccess> => {
  const sessionContext = await getSessionContext();
  if (!sessionContext.ok) {
    redirectToAuth();
  }

  const { ok: _ok, ...access } = sessionContext as SessionContextOk;
  return access;
};

export const redirectSignedInUserToApp = async () => {
  const sessionContext = await getOptionalSessionContext();
  if (!sessionContext) {
    return;
  }

  const householdResolution = await getPageHouseholdResolution(sessionContext);
  if (householdResolution.status === "resolved") {
    redirect("/household");
  }

  redirectForHouseholdResolution(householdResolution);
};

export const requirePageActiveHousehold = async () => {
  const access = await requirePageSessionUser();
  const householdResolution = await getPageHouseholdResolution(access);
  if (householdResolution.status !== "resolved") {
    redirectForHouseholdResolution(householdResolution);
  }

  const resolvedHousehold = householdResolution as Extract<
    typeof householdResolution,
    { status: "resolved" }
  >;

  return {
    ...access,
    household: resolvedHousehold.household,
  };
};

export const requirePageHouseholdSelection = async (): Promise<PageSelectionAccess> => {
  const access = await requirePageSessionUser();
  const householdResolution = await getPageHouseholdResolution(access);
  if (householdResolution.status === "none") {
    redirectForHouseholdResolution(householdResolution);
  }

  const selectableHouseholdResolution = householdResolution as Exclude<
    PageHouseholdResolution,
    { status: "none" }
  >;

  const households =
    selectableHouseholdResolution.status === "selection-required"
      ? selectableHouseholdResolution.households
      : await listActiveHouseholdsForUser(access.userId);

  if (households.length < 2) {
    redirect(households.length === 0 ? "/household/setup" : "/household");
  }

  return {
    ...access,
    householdResolution: selectableHouseholdResolution,
    households,
  };
};

export const requirePageHouseholdAdmin = async () => {
  const access = await requirePageActiveHousehold();
  if (!isHouseholdElevatedRole(access.household.role)) {
    redirect("/household");
  }

  return access;
};
