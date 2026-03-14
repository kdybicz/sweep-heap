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

const redirectForActiveHousehold = (
  activeHousehold: Awaited<ReturnType<typeof resolveActiveHousehold>>,
): never => {
  redirect(
    activeHousehold.status === "selection-required" ? "/household/select" : "/household/setup",
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

  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: sessionContext.sessionActiveHouseholdId,
    userId: sessionContext.userId,
  });
  if (activeHousehold.status === "resolved") {
    redirect("/household");
  }

  redirectForActiveHousehold(activeHousehold);
};

export const requirePageActiveHousehold = async () => {
  const access = await requirePageSessionUser();
  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
  if (activeHousehold.status !== "resolved") {
    redirectForActiveHousehold(activeHousehold);
  }

  const resolvedHousehold = activeHousehold as Extract<
    typeof activeHousehold,
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

export const requirePageWithoutHousehold = async () => {
  const access = await requirePageSessionUser();
  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
  if (activeHousehold.status === "resolved") {
    redirect("/household");
  }

  if (activeHousehold.status === "selection-required") {
    redirectForActiveHousehold(activeHousehold);
  }

  return access;
};
