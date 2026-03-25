"use client";

import {
  AppFormField,
  AppFormSection,
  appDangerMessageClass,
  appInfoMessageClass,
  appInputClass,
  appPrimaryButtonClass,
  appSecondaryButtonClass,
} from "@/app/components/AppFormPrimitives";
import HouseholdMembersTable from "@/app/household/members/HouseholdMembersTable";
import type { HouseholdMembersViewProps } from "@/app/household/members/household-members-view.types";
import { useHouseholdActionsMenu } from "@/app/household/members/useHouseholdActionsMenu";
import { useHouseholdMembersActions } from "@/app/household/members/useHouseholdMembersActions";

export default function HouseholdMembersView({
  hasElevatedHouseholdRole,
  initialMembers,
  initialPendingInvites,
  viewerUserId,
}: HouseholdMembersViewProps) {
  const {
    closeActionsMenu,
    openActionsMenuId,
    renderActionsMenu,
    setActionsMenuButtonRef,
    toggleActionsMenu,
  } = useHouseholdActionsMenu();
  const {
    error,
    filteredRows,
    handleInvite,
    handleLeaveHousehold,
    handleRemove,
    handleResendInvite,
    handleRevokeInvite,
    handleRoleChange,
    handleTransferOwnership,
    inviteEmail,
    inviteOpen,
    inviteSubmitting,
    leavingHousehold,
    message,
    query,
    removingUserId,
    resendingInviteId,
    revokingInviteId,
    roleUpdatingUserId,
    setInviteEmail,
    setQuery,
    toggleInviteOpen,
    transferringOwnerUserId,
    viewerIsOwner,
  } = useHouseholdMembersActions({
    closeActionsMenu,
    initialMembers,
    initialPendingInvites,
    viewerUserId,
  });

  const activeMembersCount = filteredRows.filter((row) => row.kind === "member").length;
  const pendingInvitesCount = filteredRows.filter((row) => row.kind === "invite").length;

  return (
    <div className="flex flex-col gap-5">
      <AppFormSection
        description="Search the current roster, send a fresh invite, or review what is still pending."
        title="Roster controls"
      >
        <div className="flex flex-wrap gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          <span className="rounded-[0.7rem] border border-[var(--stroke-soft)] bg-[var(--accent-secondary-soft)] px-3 py-1.5 text-[var(--ink)]">
            {activeMembersCount} active
          </span>
          <span className="rounded-[0.7rem] border border-[var(--stroke-soft)] bg-[var(--accent-gold-soft)] px-3 py-1.5 text-[var(--ink)]">
            {pendingInvitesCount} pending
          </span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-md flex-1">
            <AppFormField
              description="Search by name, email, role, or current status."
              htmlFor="household-members-query"
              label="Search members and invites"
            >
              <input
                className={appInputClass}
                id="household-members-query"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, role, or status"
                type="search"
                value={query}
              />
            </AppFormField>
          </div>

          <button
            className={`w-full lg:w-auto ${inviteOpen ? appSecondaryButtonClass : appPrimaryButtonClass}`}
            onClick={toggleInviteOpen}
            type="button"
          >
            {inviteOpen ? "Close invite" : "Invite member"}
          </button>
        </div>
      </AppFormSection>

      {inviteOpen ? (
        <form className="contents" onSubmit={handleInvite}>
          <AppFormSection
            description="New invites stay visible in the list below until they are accepted, revoked, or expire."
            title="Send an invite"
          >
            <AppFormField
              description="Send the invite to the exact email address the person will use to sign in."
              htmlFor="household-members-invite-email"
              label="Invite by email"
            >
              <input
                className={appInputClass}
                id="household-members-invite-email"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="friend@example.com"
                required
                type="email"
                value={inviteEmail}
              />
            </AppFormField>

            <div className="flex flex-wrap items-center gap-3">
              <button className={appPrimaryButtonClass} disabled={inviteSubmitting} type="submit">
                {inviteSubmitting ? "Inviting..." : "Send invite"}
              </button>
            </div>
          </AppFormSection>
        </form>
      ) : null}

      {error ? <div className={appDangerMessageClass}>{error}</div> : null}

      {message ? <div className={appInfoMessageClass}>{message}</div> : null}

      {!hasElevatedHouseholdRole ? (
        <div className={appInfoMessageClass}>
          You can invite new members, resend pending invites, and leave your own membership. Role
          changes, removals, and invite revokes are limited to admins and owners.
        </div>
      ) : null}

      <HouseholdMembersTable
        hasElevatedHouseholdRole={hasElevatedHouseholdRole}
        viewerIsOwner={viewerIsOwner}
        filteredRows={filteredRows}
        leavingHousehold={leavingHousehold}
        openActionsMenuId={openActionsMenuId}
        removingUserId={removingUserId}
        renderActionsMenu={renderActionsMenu}
        resendingInviteId={resendingInviteId}
        revokingInviteId={revokingInviteId}
        roleUpdatingUserId={roleUpdatingUserId}
        setActionsMenuButtonRef={setActionsMenuButtonRef}
        toggleActionsMenu={toggleActionsMenu}
        transferringOwnerUserId={transferringOwnerUserId}
        viewerUserId={viewerUserId}
        onLeaveHousehold={handleLeaveHousehold}
        onRemove={handleRemove}
        onResendInvite={handleResendInvite}
        onRevokeInvite={handleRevokeInvite}
        onRoleChange={handleRoleChange}
        onTransferOwnership={handleTransferOwnership}
      />
    </div>
  );
}
