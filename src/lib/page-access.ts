import { redirect } from "next/navigation";

import { getSession } from "@/auth";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { resolveActiveHousehold } from "@/lib/services";

const redirectToAuth = () => {
  redirect("/auth");
};

export const requirePageSessionUser = async () => {
  const session = await getSession();
  const user = session?.user;
  const rawUserId = user?.id;
  if (!rawUserId) {
    redirectToAuth();
  }

  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) {
    redirectToAuth();
  }

  const rawSessionActiveHouseholdId = session?.session?.activeOrganizationId;
  const sessionActiveHouseholdId =
    rawSessionActiveHouseholdId === undefined ||
    rawSessionActiveHouseholdId === null ||
    rawSessionActiveHouseholdId === ""
      ? null
      : Number(rawSessionActiveHouseholdId);

  return {
    sessionActiveHouseholdId:
      typeof sessionActiveHouseholdId === "number" &&
      Number.isInteger(sessionActiveHouseholdId) &&
      sessionActiveHouseholdId > 0
        ? sessionActiveHouseholdId
        : null,
    sessionUserId: String(rawUserId),
    sessionUserName: typeof user?.name === "string" ? user.name : null,
    sessionUserEmail: typeof user?.email === "string" ? user.email : null,
    userId,
  };
};

export const redirectSignedInUserToApp = async () => {
  const session = await getSession();
  const rawUserId = session?.user?.id;
  if (!rawUserId) {
    return;
  }

  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) {
    return;
  }

  const rawSessionActiveHouseholdId = session?.session?.activeOrganizationId;
  const sessionActiveHouseholdId =
    rawSessionActiveHouseholdId === undefined ||
    rawSessionActiveHouseholdId === null ||
    rawSessionActiveHouseholdId === ""
      ? null
      : Number(rawSessionActiveHouseholdId);

  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId:
      typeof sessionActiveHouseholdId === "number" &&
      Number.isInteger(sessionActiveHouseholdId) &&
      sessionActiveHouseholdId > 0
        ? sessionActiveHouseholdId
        : null,
    userId,
  });
  if (activeHousehold.status === "resolved") {
    redirect("/household");
  }

  redirect(
    activeHousehold.status === "selection-required" ? "/household/select" : "/household/setup",
  );
};

export const requirePageActiveHousehold = async () => {
  const access = await requirePageSessionUser();
  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
  if (activeHousehold.status !== "resolved") {
    redirect(
      activeHousehold.status === "selection-required" ? "/household/select" : "/household/setup",
    );
  }

  return {
    ...access,
    household: activeHousehold.household,
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
    redirect("/household/select");
  }

  return access;
};
