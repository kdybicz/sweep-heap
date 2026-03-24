import HouseholdBoard from "@/app/household/board/HouseholdBoard";
import { HouseholdViewerProvider } from "@/app/household/board/HouseholdViewerContext";
import { canManageHouseholdChores, isHouseholdElevatedRole } from "@/lib/household-roles";
import { requirePageActiveHousehold } from "@/lib/page-access";
import { listActiveHouseholdsForUser } from "@/lib/repositories";

export default async function HouseholdPage() {
  const access = await requirePageActiveHousehold();
  const { household } = access;
  const allHouseholds = await listActiveHouseholdsForUser(access.userId);

  const isHouseholdAdmin = isHouseholdElevatedRole(household.role);
  const canManageChores = canManageHouseholdChores({
    role: household.role,
    membersCanManageChores: household.membersCanManageChores,
  });
  const canSwitchHouseholds = allHouseholds.length > 1;
  const householdName = household.name.trim() || "Your household";
  const householdIcon = household.icon?.trim() || "";
  const userName =
    access.sessionUserName?.trim() || access.sessionUserEmail?.split("@")[0]?.trim() || "You";

  return (
    <HouseholdViewerProvider
      canManageChores={canManageChores}
      canSwitchHouseholds={canSwitchHouseholds}
      householdIcon={householdIcon}
      householdName={householdName}
      isHouseholdAdmin={isHouseholdAdmin}
      userName={userName}
    >
      <HouseholdBoard />
    </HouseholdViewerProvider>
  );
}
