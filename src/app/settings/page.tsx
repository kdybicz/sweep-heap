import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import AppearanceSettingsForm from "@/app/settings/AppearanceSettingsForm";
import { requirePageActiveHousehold } from "@/lib/page-access";

export default async function SettingsPage() {
  await requirePageActiveHousehold();

  return (
    <AppPageShell>
      <AppPageHeader
        aside={<AppPageBackLink href="/household" label="Back to board" />}
        description="Choose how the app looks. System is the default and follows your device theme."
        eyebrow="Settings"
        title="Appearance"
      />

      <AppPageCard>
        <AppearanceSettingsForm />
      </AppPageCard>
    </AppPageShell>
  );
}
