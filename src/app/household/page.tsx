import HouseholdBoard from "@/app/household/board/HouseholdBoard";
import { HouseholdViewerProvider } from "@/app/household/board/HouseholdViewerContext";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { requirePageActiveHousehold } from "@/lib/page-access";

export default async function HouseholdPage() {
  const access = await requirePageActiveHousehold();
  const { household } = access;

  const isHouseholdAdmin = isHouseholdElevatedRole(household.role);
  const householdName = household.name.trim() || "Your household";
  const householdIcon = household.icon?.trim() || "";
  const userName =
    access.sessionUserName?.trim() || access.sessionUserEmail?.split("@")[0]?.trim() || "You";

  return (
    <HouseholdViewerProvider
      householdIcon={householdIcon}
      householdName={householdName}
      isHouseholdAdmin={isHouseholdAdmin}
      userName={userName}
    >
      <HouseholdBoard />
    </HouseholdViewerProvider>
  );
}
