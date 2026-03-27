"use client";

import type { ReactNode } from "react";
import {
  formatDate,
  type HouseholdMember,
  type HouseholdMemberRole,
  type HouseholdPendingInvite,
  type HouseholdRow,
  toHouseholdMemberRole,
  toRoleLabel,
} from "@/app/household/members/members-view-utils";

type RenderActionsMenu = (menuId: string, className: string, content: ReactNode) => ReactNode;

type ActionsMenuTriggerProps = {
  ariaExpanded: boolean;
  ariaLabel: string;
  disabled: boolean;
  menuId: string;
  onToggle: (menuId: string) => void;
  setActionsMenuButtonRef: (menuId: string) => (node: HTMLButtonElement | null) => void;
};

type HouseholdInviteRowProps = {
  hasElevatedHouseholdRole: boolean;
  viewerIsOwner: boolean;
  invite: HouseholdPendingInvite;
  openActionsMenuId: string | null;
  renderActionsMenu: RenderActionsMenu;
  resendingInviteId: number | null;
  revokingInviteId: number | null;
  setActionsMenuButtonRef: (menuId: string) => (node: HTMLButtonElement | null) => void;
  toggleActionsMenu: (menuId: string) => void;
  onResendInvite: (invite: HouseholdPendingInvite) => void;
  onRevokeInvite: (invite: HouseholdPendingInvite) => void;
};

type HouseholdMemberRowProps = {
  hasElevatedHouseholdRole: boolean;
  viewerIsOwner: boolean;
  leavingHousehold: boolean;
  member: HouseholdMember;
  openActionsMenuId: string | null;
  removingUserId: number | null;
  renderActionsMenu: RenderActionsMenu;
  roleUpdatingUserId: number | null;
  setActionsMenuButtonRef: (menuId: string) => (node: HTMLButtonElement | null) => void;
  toggleActionsMenu: (menuId: string) => void;
  transferringOwnerUserId: number | null;
  viewerUserId: number;
  onLeaveHousehold: () => void;
  onRemove: (member: HouseholdMember) => void;
  onRoleChange: (input: { role: HouseholdMemberRole; userId: number }) => void;
  onTransferOwnership: (member: HouseholdMember) => void;
};

type HouseholdMembersTableProps = {
  hasElevatedHouseholdRole: boolean;
  viewerIsOwner: boolean;
  filteredRows: HouseholdRow[];
  leavingHousehold: boolean;
  openActionsMenuId: string | null;
  removingUserId: number | null;
  renderActionsMenu: RenderActionsMenu;
  resendingInviteId: number | null;
  revokingInviteId: number | null;
  roleUpdatingUserId: number | null;
  setActionsMenuButtonRef: (menuId: string) => (node: HTMLButtonElement | null) => void;
  toggleActionsMenu: (menuId: string) => void;
  transferringOwnerUserId: number | null;
  viewerUserId: number;
  onLeaveHousehold: () => void;
  onRemove: (member: HouseholdMember) => void;
  onResendInvite: (invite: HouseholdPendingInvite) => void;
  onRevokeInvite: (invite: HouseholdPendingInvite) => void;
  onRoleChange: (input: { role: HouseholdMemberRole; userId: number }) => void;
  onTransferOwnership: (member: HouseholdMember) => void;
};

const ActionsMenuTrigger = ({
  ariaExpanded,
  ariaLabel,
  disabled,
  menuId,
  onToggle,
  setActionsMenuButtonRef,
}: ActionsMenuTriggerProps) => (
  <button
    aria-expanded={ariaExpanded}
    aria-label={ariaLabel}
    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={() => onToggle(menuId)}
    ref={setActionsMenuButtonRef(menuId)}
    type="button"
  >
    <span className="sr-only">{ariaLabel}</span>
    <span className="flex items-center gap-0.5 text-[var(--muted)]">
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
    </span>
  </button>
);

const HouseholdInviteRow = ({
  hasElevatedHouseholdRole,
  viewerIsOwner,
  invite,
  onResendInvite,
  onRevokeInvite,
  openActionsMenuId,
  renderActionsMenu,
  resendingInviteId,
  revokingInviteId,
  setActionsMenuButtonRef,
  toggleActionsMenu,
}: HouseholdInviteRowProps) => {
  const isResending = resendingInviteId === invite.id;
  const isRevoking = revokingInviteId === invite.id;
  const canManageOwnerInviteRole = viewerIsOwner || invite.role !== "owner";
  const disableResend = isResending || isRevoking || !canManageOwnerInviteRole;
  const disableRevoke =
    !hasElevatedHouseholdRole || isResending || isRevoking || !canManageOwnerInviteRole;
  const actionsMenuId = `invite-${invite.id}`;
  const disableActionsMenu = disableResend && disableRevoke;

  return (
    <tr className="border-b border-[var(--stroke-soft)] last:border-b-0 hover:bg-[var(--surface-weak)]/70">
      <td className="px-4 py-4 font-semibold text-[var(--muted)]">Pending invite</td>
      <td className="px-4 py-4 text-[var(--muted)]">{invite.email}</td>
      <td className="px-4 py-3">
        <span className="border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {toRoleLabel(invite.role)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="border border-[var(--stroke-soft)] bg-[var(--accent-gold-soft)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Pending
        </span>
      </td>
      <td className="px-4 py-4 text-[var(--muted)]">{formatDate(invite.createdAt)}</td>
      <td className="px-4 py-4 text-right">
        <div className="relative inline-flex justify-end" data-actions-menu-root={actionsMenuId}>
          <ActionsMenuTrigger
            ariaExpanded={openActionsMenuId === actionsMenuId}
            ariaLabel="Open invite actions"
            disabled={disableActionsMenu}
            menuId={actionsMenuId}
            onToggle={toggleActionsMenu}
            setActionsMenuButtonRef={setActionsMenuButtonRef}
          />
          {renderActionsMenu(
            actionsMenuId,
            "min-w-44 rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]",
            <>
              <button
                className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disableResend}
                onClick={() => onResendInvite(invite)}
                type="button"
              >
                <span>Resend invite</span>
                <span>{isResending ? "..." : null}</span>
              </button>
              <button
                className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disableRevoke}
                onClick={() => onRevokeInvite(invite)}
                type="button"
              >
                <span>Revoke</span>
                <span>{isRevoking ? "..." : null}</span>
              </button>
            </>,
          )}
        </div>
        <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Expires {formatDate(invite.expiresAt)}
        </div>
      </td>
    </tr>
  );
};

const HouseholdMemberRow = ({
  hasElevatedHouseholdRole,
  viewerIsOwner,
  leavingHousehold,
  member,
  onLeaveHousehold,
  onRemove,
  onRoleChange,
  onTransferOwnership,
  openActionsMenuId,
  removingUserId,
  renderActionsMenu,
  roleUpdatingUserId,
  setActionsMenuButtonRef,
  toggleActionsMenu,
  transferringOwnerUserId,
  viewerUserId,
}: HouseholdMemberRowProps) => {
  const isViewer = member.userId === viewerUserId;
  const roleIsUpdating = roleUpdatingUserId === member.userId;
  const isTransferringOwner = transferringOwnerUserId === member.userId;
  const isRemoving = removingUserId === member.userId;
  const canLeaveHousehold = isViewer && member.role !== "owner";
  const isLeavingHousehold = isViewer && leavingHousehold;
  const canEditOwnerMembers = viewerIsOwner || member.role !== "owner";
  const canEditMemberRole = hasElevatedHouseholdRole && canEditOwnerMembers;
  const disableRoleChange =
    !canEditMemberRole ||
    isViewer ||
    roleIsUpdating ||
    isRemoving ||
    isTransferringOwner ||
    isLeavingHousehold;
  const disableRemove =
    !canEditMemberRole ||
    isViewer ||
    roleIsUpdating ||
    isRemoving ||
    isTransferringOwner ||
    isLeavingHousehold;
  const showTransferOwnership = viewerIsOwner && !isViewer && member.role !== "owner";
  const disableTransferOwnership =
    roleIsUpdating || isRemoving || isTransferringOwner || !showTransferOwnership;
  const disableLeaveHousehold =
    !canLeaveHousehold || roleIsUpdating || isRemoving || isTransferringOwner || isLeavingHousehold;
  const actionsMenuId = `member-${member.userId}`;
  const disableActionsMenu = disableTransferOwnership && disableRemove && disableLeaveHousehold;

  return (
    <tr className="border-b border-[var(--stroke-soft)] last:border-b-0 hover:bg-[var(--surface-weak)]/70">
      <td className="px-4 py-4 font-semibold">
        {member.name?.trim() || "No name"}
        {isViewer ? (
          <span className="ml-2 border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            You
          </span>
        ) : null}
      </td>
      <td className="px-4 py-4 text-[var(--muted)]">{member.email}</td>
      <td className="px-4 py-4">
        {canEditMemberRole ? (
          <select
            className="rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] outline-none transition focus:border-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
            value={member.role}
            onChange={(event) =>
              onRoleChange({
                userId: member.userId,
                role: toHouseholdMemberRole(event.target.value),
              })
            }
            disabled={disableRoleChange}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            {viewerIsOwner ? <option value="owner">Owner</option> : null}
          </select>
        ) : (
          <span className="border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            {toRoleLabel(member.role)}
          </span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className="border border-[var(--stroke-soft)] bg-[var(--accent-tertiary-soft)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Active
        </span>
      </td>
      <td className="px-4 py-4 text-[var(--muted)]">{formatDate(member.joinedAt)}</td>
      <td className="px-4 py-4 text-right">
        <div className="relative inline-flex justify-end" data-actions-menu-root={actionsMenuId}>
          <ActionsMenuTrigger
            ariaExpanded={openActionsMenuId === actionsMenuId}
            ariaLabel="Open member actions"
            disabled={disableActionsMenu}
            menuId={actionsMenuId}
            onToggle={toggleActionsMenu}
            setActionsMenuButtonRef={setActionsMenuButtonRef}
          />
          {renderActionsMenu(
            actionsMenuId,
            "min-w-48 rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]",
            <>
              <button
                className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disableTransferOwnership}
                onClick={() => onTransferOwnership(member)}
                type="button"
              >
                <span>Transfer ownership</span>
                <span>{isTransferringOwner ? "..." : null}</span>
              </button>
              <button
                className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disableRemove}
                onClick={() => onRemove(member)}
                type="button"
              >
                <span>Remove</span>
                <span>{isRemoving ? "..." : null}</span>
              </button>
              {canLeaveHousehold ? (
                <button
                  className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disableLeaveHousehold}
                  onClick={onLeaveHousehold}
                  type="button"
                >
                  <span>Leave household</span>
                  <span>{isLeavingHousehold ? "..." : null}</span>
                </button>
              ) : null}
            </>,
          )}
        </div>
      </td>
    </tr>
  );
};

export default function HouseholdMembersTable({
  hasElevatedHouseholdRole,
  viewerIsOwner,
  filteredRows,
  leavingHousehold,
  openActionsMenuId,
  removingUserId,
  renderActionsMenu,
  resendingInviteId,
  revokingInviteId,
  roleUpdatingUserId,
  setActionsMenuButtonRef,
  toggleActionsMenu,
  transferringOwnerUserId,
  viewerUserId,
  onLeaveHousehold,
  onRemove,
  onResendInvite,
  onRevokeInvite,
  onRoleChange,
  onTransferOwnership,
}: HouseholdMembersTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-4">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-secondary)]">
          Members and invites
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[var(--ink)]">
          <thead className="border-b border-[var(--stroke-soft)] bg-[var(--surface)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Added</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map((row) =>
                row.kind === "invite" ? (
                  <HouseholdInviteRow
                    hasElevatedHouseholdRole={hasElevatedHouseholdRole}
                    viewerIsOwner={viewerIsOwner}
                    invite={row.invite}
                    key={`invite-${row.invite.id}`}
                    onResendInvite={onResendInvite}
                    onRevokeInvite={onRevokeInvite}
                    openActionsMenuId={openActionsMenuId}
                    renderActionsMenu={renderActionsMenu}
                    resendingInviteId={resendingInviteId}
                    revokingInviteId={revokingInviteId}
                    setActionsMenuButtonRef={setActionsMenuButtonRef}
                    toggleActionsMenu={toggleActionsMenu}
                  />
                ) : (
                  <HouseholdMemberRow
                    hasElevatedHouseholdRole={hasElevatedHouseholdRole}
                    viewerIsOwner={viewerIsOwner}
                    key={`member-${row.member.userId}`}
                    leavingHousehold={leavingHousehold}
                    member={row.member}
                    onLeaveHousehold={onLeaveHousehold}
                    onRemove={onRemove}
                    onRoleChange={onRoleChange}
                    onTransferOwnership={onTransferOwnership}
                    openActionsMenuId={openActionsMenuId}
                    removingUserId={removingUserId}
                    renderActionsMenu={renderActionsMenu}
                    roleUpdatingUserId={roleUpdatingUserId}
                    setActionsMenuButtonRef={setActionsMenuButtonRef}
                    toggleActionsMenu={toggleActionsMenu}
                    transferringOwnerUserId={transferringOwnerUserId}
                    viewerUserId={viewerUserId}
                  />
                ),
              )
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-[var(--muted)]" colSpan={6}>
                  No members or invites match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
