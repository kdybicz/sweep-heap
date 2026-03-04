import { redirect } from "next/navigation";
import HouseholdBoard from "@/app/household/board/HouseholdBoard";
import { HouseholdViewerProvider } from "@/app/household/board/HouseholdViewerContext";
import { getSession } from "@/auth";
import { getActiveHouseholdSummary } from "@/lib/repositories";

export default async function HouseholdPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    redirect("/auth");
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    redirect("/household/setup");
  }

  const isHouseholdAdmin = household.role === "admin";
  const householdName = household.name.trim() || "Your household";
  const householdIcon = household.icon?.trim() || "";
  const userName = session.user.name?.trim() || session.user.email?.split("@")[0]?.trim() || "You";

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
