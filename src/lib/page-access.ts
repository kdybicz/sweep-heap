import { redirect } from "next/navigation";

import { getSession } from "@/auth";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { getActiveHouseholdSummary, getUserMemberships } from "@/lib/repositories";

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

  return {
    sessionUserId: String(rawUserId),
    sessionUserName: typeof user?.name === "string" ? user.name : null,
    sessionUserEmail: typeof user?.email === "string" ? user.email : null,
    userId,
  };
};

export const requirePageActiveHousehold = async () => {
  const access = await requirePageSessionUser();
  const { userId } = access;
  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    redirect("/household/setup");
  }

  return {
    ...access,
    userId,
    household,
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
  const memberships = await getUserMemberships(access.userId);
  if (memberships.length) {
    redirect("/household");
  }

  return access;
};
