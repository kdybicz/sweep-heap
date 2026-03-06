import { headers } from "next/headers";
import Link from "next/link";

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
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Household</div>
          <h1 className="text-3xl font-semibold">Members</h1>
          <p className="text-sm text-[var(--muted)]">
            Manage who can access {household.name.trim() || "your household"}. Search members,
            invite new people, and set household roles.
          </p>
        </header>

        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
          <HouseholdMembersView
            canAdministerMembers={isHouseholdElevatedRole(household.role)}
            initialMembers={initialMembers}
            initialPendingInvites={initialPendingInvites}
            viewerUserId={userId}
          />
        </div>

        <div>
          <Link
            className="inline-flex rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            href="/household"
          >
            Back to board
          </Link>
        </div>
      </div>
    </main>
  );
}
