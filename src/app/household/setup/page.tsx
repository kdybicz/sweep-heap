import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import HouseholdSetupForm from "@/app/household/setup/HouseholdSetupForm";
import { requirePageSessionUser } from "@/lib/page-access";
import { resolveActiveHousehold } from "@/lib/services/active-household-service";

export default async function HouseholdSetupPage() {
  const access = await requirePageSessionUser();
  const householdResolution = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
  const exitAction =
    householdResolution.status === "resolved"
      ? { href: "/household", label: "Back to board" }
      : householdResolution.status === "selection-required"
        ? { href: "/household/select", label: "Back to household selection" }
        : null;

  return (
    <AppPageShell>
      <AppPageHeader
        aside={
          exitAction ? <AppPageBackLink href={exitAction.href} label={exitAction.label} /> : null
        }
        description="Give your household a name, icon, and time zone to anchor weekly chores."
        eyebrow="Setup"
        title="Create your household"
      />
      <AppPageCard>
        <HouseholdSetupForm />
      </AppPageCard>
    </AppPageShell>
  );
}
