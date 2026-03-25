import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import HouseholdEditForm from "@/app/household/edit/HouseholdEditForm";
import { requirePageHouseholdAdmin } from "@/lib/page-access";

export default async function HouseholdEditPage() {
  const { household } = await requirePageHouseholdAdmin();

  return (
    <AppPageShell>
      <AppPageHeader
        aside={<AppPageBackLink href="/household" label="Back to board" />}
        description="Update the household name, icon, and time zone for your choreboard."
        eyebrow="Household settings"
        title="Edit household"
      />
      <AppPageCard>
        <HouseholdEditForm
          canDeleteHousehold={household.role === "owner"}
          initialIcon={household.icon ?? ""}
          initialMembersCanManageChores={household.membersCanManageChores ?? true}
          initialName={household.name}
          initialTimeZone={household.timeZone}
        />
      </AppPageCard>
    </AppPageShell>
  );
}
