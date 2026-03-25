import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import HouseholdSelectionList from "@/app/household/select/HouseholdSelectionList";
import { requirePageHouseholdSelection } from "@/lib/page-access";

export default async function HouseholdSelectPage() {
  const { households, householdResolution } = await requirePageHouseholdSelection();
  const showBackLink = householdResolution.status === "resolved";

  return (
    <AppPageShell size="list">
      <AppPageHeader
        aside={showBackLink ? <AppPageBackLink href="/household" label="Back to board" /> : null}
        description="Select the household you want to work in. You can switch again later."
        eyebrow="Households"
        title="Choose your household"
      />

      <AppPageCard className="sm:p-8" padding="md">
        <HouseholdSelectionList households={households} />
      </AppPageCard>
    </AppPageShell>
  );
}
