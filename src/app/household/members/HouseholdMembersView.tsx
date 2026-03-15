"use client";

import HouseholdMembersTable from "@/app/household/members/HouseholdMembersTable";
import type { HouseholdMembersViewProps } from "@/app/household/members/household-members-view.types";
import { useHouseholdActionsMenu } from "@/app/household/members/useHouseholdActionsMenu";
import { useHouseholdMembersActions } from "@/app/household/members/useHouseholdMembersActions";

export default function HouseholdMembersView({
  canAdministerMembers,
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
    canManageOwnerRole,
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
  } = useHouseholdMembersActions({
    closeActionsMenu,
    initialMembers,
    initialPendingInvites,
    viewerUserId,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex max-w-md flex-1 flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Search members and invites
          <input
            className="rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, role, or status"
          />
        </label>

        <button
          className="w-full rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] lg:w-auto"
          type="button"
          onClick={toggleInviteOpen}
        >
          {inviteOpen ? "Close invite" : "Invite"}
        </button>
      </div>

      {inviteOpen ? (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--card)] p-4"
          onSubmit={handleInvite}
        >
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Invite by email
            <input
              className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="friend@example.com"
              required
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            New invites appear in the table below until accepted or expired.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={inviteSubmitting}
            >
              {inviteSubmitting ? "Inviting..." : "Send invite"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold text-[var(--ink)]">
          {message}
        </div>
      ) : null}

      {!canAdministerMembers ? (
        <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
          You can invite new members and leave your own membership. Role changes and removals are
          limited to admins and owners.
        </div>
      ) : null}

      <HouseholdMembersTable
        canAdministerMembers={canAdministerMembers}
        canManageOwnerRole={canManageOwnerRole}
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
