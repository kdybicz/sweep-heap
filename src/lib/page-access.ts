import { redirect } from "next/navigation";

import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { resolveActiveHousehold } from "@/lib/services";
import {
  getOptionalSessionContext,
  getSessionContext,
  type SessionContextOk,
} from "@/lib/session-context";

type PageSessionAccess = Omit<SessionContextOk, "ok">;

const redirectToAuth = (): never => {
  redirect("/auth");
};

const redirectForHouseholdResolution = (
  householdResolution: Awaited<ReturnType<typeof resolveActiveHousehold>>,
): never => {
  redirect(
    householdResolution.status === "selection-required" ? "/household/select" : "/household/setup",
  );
};

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

  const householdResolution = await resolveActiveHousehold({
    sessionActiveHouseholdId: sessionContext.sessionActiveHouseholdId,
    userId: sessionContext.userId,
  });
  if (householdResolution.status === "resolved") {
    redirect("/household");
  }

  redirectForHouseholdResolution(householdResolution);
};

export const requirePageActiveHousehold = async () => {
  const access = await requirePageSessionUser();
  const householdResolution = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
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

export const requirePageHouseholdAdmin = async () => {
  const access = await requirePageActiveHousehold();
  if (!isHouseholdElevatedRole(access.household.role)) {
    redirect("/household");
  }

  return access;
};
