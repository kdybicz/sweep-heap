import { redirect } from "next/navigation";
import HouseholdBoard from "@/app/household/board/HouseholdBoard";
import { HouseholdViewerProvider } from "@/app/household/board/HouseholdViewerContext";
import { auth } from "@/auth";
import { getUserMemberships } from "@/lib/repositories";

export default async function HouseholdPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    redirect("/auth");
  }

  const memberships = await getUserMemberships(userId);
  if (!memberships.length) {
    redirect("/household/setup");
  }

  const isHouseholdAdmin = memberships[0]?.role === "admin";

  return (
    <HouseholdViewerProvider isHouseholdAdmin={isHouseholdAdmin}>
      <HouseholdBoard />
    </HouseholdViewerProvider>
  );
}
