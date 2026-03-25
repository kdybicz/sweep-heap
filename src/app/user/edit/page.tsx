import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import DeleteAccountForm from "@/app/user/edit/DeleteAccountForm";
import UserDetailsEditForm from "@/app/user/edit/UserDetailsEditForm";
import { requirePageActiveHousehold } from "@/lib/page-access";

export default async function UserEditPage() {
  const access = await requirePageActiveHousehold();
  const { household } = access;

  return (
    <AppPageShell>
      <AppPageHeader
        aside={<AppPageBackLink href="/household" label="Back to board" />}
        description="Update your name. Your email and household time zone are read only."
        eyebrow="Profile"
        title="Edit profile"
      />
      <AppPageCard>
        <UserDetailsEditForm
          email={access.sessionUserEmail ?? ""}
          householdTimeZone={household.timeZone}
          initialName={access.sessionUserName ?? ""}
        />
      </AppPageCard>
      <AppPageCard tone="danger">
        <DeleteAccountForm />
      </AppPageCard>
    </AppPageShell>
  );
}
