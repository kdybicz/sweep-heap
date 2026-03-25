import { headers } from "next/headers";

import {
  AppPageBackLink,
  AppPageCard,
  AppPageHeader,
  AppPageShell,
} from "@/app/components/AppPageShell";
import HouseholdMembersView from "@/app/household/members/HouseholdMembersView";
import { getHouseholdMembersSnapshot } from "@/lib/household-members";
import { isHouseholdElevatedRole } from "@/lib/household-roles";
import { requirePageActiveHousehold } from "@/lib/page-access";

export default async function HouseholdMembersPage() {
  const { household, userId } = await requirePageActiveHousehold();
  const requestHeaders = new Headers(await headers());
  const { members, pendingInvites } = await getHouseholdMembersSnapshot({
    householdId: household.id,
    requestHeaders,
  });
  const initialMembers = members.map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: member.role,
    joinedAt: new Date(member.joinedAt).toISOString(),
  }));
  const initialPendingInvites = pendingInvites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    createdAt: new Date(invite.createdAt).toISOString(),
    expiresAt: new Date(invite.expiresAt).toISOString(),
  }));

  return (
    <AppPageShell size="wide">
      <AppPageHeader
        aside={<AppPageBackLink href="/household" label="Back to board" />}
        description={`Manage who can access ${household.name.trim() || "your household"}. Search members, invite new people, and set household roles.`}
        eyebrow="Household"
        title="Members"
      />

      <AppPageCard className="sm:p-8" padding="md">
        <HouseholdMembersView
          hasElevatedHouseholdRole={isHouseholdElevatedRole(household.role)}
          initialMembers={initialMembers}
          initialPendingInvites={initialPendingInvites}
          viewerUserId={userId}
        />
      </AppPageCard>
    </AppPageShell>
  );
}
