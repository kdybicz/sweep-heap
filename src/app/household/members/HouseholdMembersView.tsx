"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  readApiJsonResponse,
  recoverFromHouseholdContextError,
} from "@/app/household/household-context-client";
import {
  formatDate,
  type HouseholdMember,
  type HouseholdMemberRole,
  type HouseholdPendingInvite,
  type HouseholdRow,
  sortMembers,
  sortPendingInvites,
  toHouseholdMemberRole,
  toRoleLabel,
  toSearchText,
} from "@/app/household/members/members-view-utils";

type HouseholdMembersViewProps = {
  canAdministerMembers: boolean;
  initialMembers: HouseholdMember[];
  initialPendingInvites: HouseholdPendingInvite[];
  viewerUserId: number;
};

type HouseholdMembersApiResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  existingInvite?: {
    id: number | string;
    email: string;
    role: string;
    createdAt: string;
    expiresAt: string;
  };
  invite?: {
    id: number | string;
    email: string;
    role: string;
    createdAt: string;
    expiresAt: string;
  };
  inviteEmailSent?: boolean;
  member?: {
    userId: number | string;
    name?: string | null;
    email: string;
    role: string;
    joinedAt: string;
  };
  members?: Array<{
    userId: number | string;
    name?: string | null;
    email: string;
    role: string;
    joinedAt: string;
  }>;
};

type ActionsMenuPosition = {
  left: number;
  top: number;
};

export default function HouseholdMembersView({
  canAdministerMembers,
  initialMembers,
  initialPendingInvites,
  viewerUserId,
}: HouseholdMembersViewProps) {
  const router = useRouter();
  const actionsMenuButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [members, setMembers] = useState(() => sortMembers(initialMembers));
  const [pendingInvites, setPendingInvites] = useState(() =>
    sortPendingInvites(initialPendingInvites),
  );
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<number | null>(null);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<number | null>(null);
  const [transferringOwnerUserId, setTransferringOwnerUserId] = useState<number | null>(null);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [leavingHousehold, setLeavingHousehold] = useState(false);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<ActionsMenuPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const viewerRole = members.find((member) => member.userId === viewerUserId)?.role ?? "member";
  const canManageOwnerRole = viewerRole === "owner";

  const filteredRows = useMemo(() => {
    const rows: HouseholdRow[] = [
      ...members.map((member) => ({ kind: "member", member }) as const),
      ...pendingInvites.map((invite) => ({ kind: "invite", invite }) as const),
    ];
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return rows;
    }
    return rows.filter((row) => toSearchText(row).includes(trimmedQuery));
  }, [members, pendingInvites, query]);

  const updateActionsMenuPosition = useCallback((menuId: string) => {
    const button = actionsMenuButtonsRef.current.get(menuId);
    if (!button) {
      setActionsMenuPosition(null);
      return;
    }

    const rect = button.getBoundingClientRect();
    setActionsMenuPosition({
      left: rect.right,
      top: rect.bottom + 8,
    });
  }, []);

  const setActionsMenuButtonRef = useCallback(
    (menuId: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        actionsMenuButtonsRef.current.set(menuId, node);
        return;
      }

      actionsMenuButtonsRef.current.delete(menuId);
    },
    [],
  );

  const toggleActionsMenu = useCallback(
    (menuId: string) => {
      setOpenActionsMenuId((currentMenuId) => {
        if (currentMenuId === menuId) {
          setActionsMenuPosition(null);
          return null;
        }

        updateActionsMenuPosition(menuId);
        return menuId;
      });
    },
    [updateActionsMenuPosition],
  );

  useEffect(() => {
    if (!openActionsMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(`[data-actions-menu-root="${openActionsMenuId}"]`) ||
        target.closest(`[data-actions-menu-panel="${openActionsMenuId}"]`)
      ) {
        return;
      }

      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionsMenuId(null);
        setActionsMenuPosition(null);
      }
    };

    const handleViewportChange = () => {
      updateActionsMenuPosition(openActionsMenuId);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [openActionsMenuId, updateActionsMenuPosition]);

  const upsertMember = (nextMember: HouseholdMember) => {
    setMembers((previousMembers) =>
      sortMembers([
        ...previousMembers.filter((member) => member.userId !== nextMember.userId),
        nextMember,
      ]),
    );
  };

  const upsertPendingInvite = (nextInvite: HouseholdPendingInvite) => {
    setPendingInvites((previousInvites) =>
      sortPendingInvites([
        ...previousInvites.filter((invite) => invite.id !== nextInvite.id),
        nextInvite,
      ]),
    );
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setInviteSubmitting(true);

    try {
      const response = await fetch("/api/households/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
        }),
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok) {
        if (data?.existingInvite) {
          upsertPendingInvite({
            id: Number(data.existingInvite.id),
            email: String(data.existingInvite.email),
            role: toHouseholdMemberRole(data.existingInvite.role),
            createdAt: String(data.existingInvite.createdAt),
            expiresAt: String(data.existingInvite.expiresAt),
          });
        }
        setError(data?.error ?? "Failed to invite member");
        setInviteSubmitting(false);
        return;
      }

      if (data.invite) {
        upsertPendingInvite({
          id: Number(data.invite.id),
          email: String(data.invite.email),
          role: toHouseholdMemberRole(data.invite.role),
          createdAt: String(data.invite.createdAt),
          expiresAt: String(data.invite.expiresAt),
        });
      }

      setInviteEmail("");
      setInviteOpen(false);
      setMessage(
        data.inviteEmailSent
          ? `Invite sent to ${data.invite?.email ?? "the user"}.`
          : "Invite created, but email delivery failed.",
      );
    } catch (inviteError) {
      const inviteMessage =
        inviteError instanceof Error ? inviteError.message : "Failed to invite member";
      setError(inviteMessage);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleResendInvite = async (invite: HouseholdPendingInvite) => {
    setError(null);
    setMessage(null);
    setResendingInviteId(invite.id);

    try {
      const response = await fetch(`/api/households/members/invites/${invite.id}`, {
        method: "POST",
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok || !data?.invite) {
        setError(data?.error ?? "Failed to resend invite");
        setResendingInviteId(null);
        return;
      }

      upsertPendingInvite({
        id: Number(data.invite.id),
        email: String(data.invite.email),
        role: toHouseholdMemberRole(data.invite.role),
        createdAt: String(data.invite.createdAt),
        expiresAt: String(data.invite.expiresAt),
      });
      setMessage(
        data.inviteEmailSent
          ? `Invite resent to ${data.invite.email}.`
          : "Invite refreshed, but email delivery failed.",
      );
    } catch (resendError) {
      const resendMessage =
        resendError instanceof Error ? resendError.message : "Failed to resend invite";
      setError(resendMessage);
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRevokeInvite = async (invite: HouseholdPendingInvite) => {
    const confirmed = window.confirm(`Revoke pending invite for ${invite.email}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setRevokingInviteId(invite.id);

    try {
      const response = await fetch(`/api/households/members/invites/${invite.id}`, {
        method: "DELETE",
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok) {
        setError(data?.error ?? "Failed to revoke invite");
        setRevokingInviteId(null);
        return;
      }

      setPendingInvites((previousInvites) =>
        previousInvites.filter((existingInvite) => existingInvite.id !== invite.id),
      );
      setMessage("Invite revoked.");
    } catch (revokeError) {
      const revokeMessage =
        revokeError instanceof Error ? revokeError.message : "Failed to revoke invite";
      setError(revokeMessage);
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleRoleChange = async ({
    role,
    userId,
  }: {
    role: HouseholdMemberRole;
    userId: number;
  }) => {
    setError(null);
    setMessage(null);
    setRoleUpdatingUserId(userId);

    try {
      const response = await fetch("/api/households/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role,
        }),
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok || !data?.member) {
        setError(data?.error ?? "Failed to update member role");
        setRoleUpdatingUserId(null);
        return;
      }

      upsertMember({
        userId: Number(data.member.userId),
        name: typeof data.member.name === "string" ? data.member.name : null,
        email: String(data.member.email),
        role: toHouseholdMemberRole(data.member.role),
        joinedAt: String(data.member.joinedAt),
      });
      setMessage("Member role updated.");
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error ? updateError.message : "Failed to update member role";
      setError(updateMessage);
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  const handleRemove = async (member: HouseholdMember) => {
    const memberLabel = member.name?.trim() || member.email;
    const confirmed = window.confirm(`Remove ${memberLabel} from this household?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setRemovingUserId(member.userId);

    try {
      const response = await fetch("/api/households/members", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: member.userId,
        }),
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok) {
        setError(data?.error ?? "Failed to remove member");
        setRemovingUserId(null);
        return;
      }

      setMembers((previousMembers) =>
        previousMembers.filter((existingMember) => existingMember.userId !== member.userId),
      );
      setMessage("Member removed.");
    } catch (removeError) {
      const removeMessage =
        removeError instanceof Error ? removeError.message : "Failed to remove member";
      setError(removeMessage);
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleTransferOwnership = async (member: HouseholdMember) => {
    const memberLabel = member.name?.trim() || member.email;
    const confirmed = window.confirm(
      `Transfer household ownership to ${memberLabel}? You will become an admin.`,
    );
    if (!confirmed) {
      return;
    }

    setOpenActionsMenuId(null);
    setActionsMenuPosition(null);
    setError(null);
    setMessage(null);
    setTransferringOwnerUserId(member.userId);

    try {
      const response = await fetch("/api/households/members/owner-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: member.userId,
        }),
      });
      const data = await readApiJsonResponse<HouseholdMembersApiResponse>(response);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok || !Array.isArray(data.members)) {
        setError(data?.error ?? "Failed to transfer ownership");
        setTransferringOwnerUserId(null);
        return;
      }

      for (const updatedMember of data.members) {
        upsertMember({
          userId: Number(updatedMember.userId),
          name: typeof updatedMember.name === "string" ? updatedMember.name : null,
          email: String(updatedMember.email),
          role: toHouseholdMemberRole(updatedMember.role),
          joinedAt: String(updatedMember.joinedAt),
        });
      }

      setMessage(`Ownership transferred to ${memberLabel}.`);
      router.refresh();
    } catch (transferError) {
      const transferMessage =
        transferError instanceof Error ? transferError.message : "Failed to transfer ownership";
      setError(transferMessage);
    } finally {
      setTransferringOwnerUserId(null);
    }
  };

  const handleLeaveHousehold = async () => {
    const confirmed = window.confirm(
      "Leave this household? You will switch to another household or onboarding if this is your last one.",
    );
    if (!confirmed) {
      return;
    }

    setOpenActionsMenuId(null);
    setActionsMenuPosition(null);
    setError(null);
    setMessage(null);
    setLeavingHousehold(true);

    try {
      const response = await fetch("/api/households/members/leave", {
        method: "POST",
      });
      const data = await readApiJsonResponse<
        HouseholdMembersApiResponse & {
          activeHouseholdActivated?: boolean;
          nextPath?: string;
        }
      >(response);
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data?.ok) {
        setError(data?.error ?? "Failed to leave household");
        setLeavingHousehold(false);
        return;
      }

      router.push(typeof data.nextPath === "string" ? data.nextPath : "/household/setup");
      router.refresh();
    } catch (leaveError) {
      const leaveMessage =
        leaveError instanceof Error ? leaveError.message : "Failed to leave household";
      setError(leaveMessage);
      setLeavingHousehold(false);
    }
  };

  const renderActionsMenu = (menuId: string, className: string, content: ReactNode) => {
    if (openActionsMenuId !== menuId || !actionsMenuPosition || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <div
        className={`fixed z-30 -translate-x-full ${className}`}
        data-actions-menu-panel={menuId}
        style={{ left: actionsMenuPosition.left, top: actionsMenuPosition.top }}
      >
        {content}
      </div>,
      document.body,
    );
  };

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
          onClick={() => {
            setInviteOpen((isOpen) => !isOpen);
            setError(null);
            setMessage(null);
          }}
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

      <div className="overflow-x-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm text-[var(--ink)]">
          <thead className="border-b border-[var(--stroke)] bg-[var(--surface-weak)] text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
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
              filteredRows.map((row) => {
                if (row.kind === "invite") {
                  const isResending = resendingInviteId === row.invite.id;
                  const isRevoking = revokingInviteId === row.invite.id;
                  const canManageOwnerInviteRole =
                    canManageOwnerRole || row.invite.role !== "owner";
                  const disableResend = isResending || isRevoking || !canManageOwnerInviteRole;
                  const disableRevoke =
                    !canAdministerMembers || isResending || isRevoking || !canManageOwnerInviteRole;
                  const actionsMenuId = `invite-${row.invite.id}`;
                  const disableActionsMenu = disableResend && disableRevoke;

                  return (
                    <tr
                      key={`invite-${row.invite.id}`}
                      className="border-b border-[var(--stroke-soft)] last:border-b-0 hover:bg-[var(--surface-weak)]"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--muted)]">
                        Pending invite
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.invite.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {toRoleLabel(row.invite.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatDate(row.invite.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="relative inline-flex justify-end"
                          data-actions-menu-root={actionsMenuId}
                        >
                          <button
                            aria-expanded={openActionsMenuId === actionsMenuId}
                            aria-label="Open invite actions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-[var(--surface-weak)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disableActionsMenu}
                            onClick={() => toggleActionsMenu(actionsMenuId)}
                            ref={setActionsMenuButtonRef(actionsMenuId)}
                            type="button"
                          >
                            <span className="sr-only">Open invite actions</span>
                            <span className="flex items-center gap-0.5 text-[var(--muted)]">
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                            </span>
                          </button>
                          {renderActionsMenu(
                            actionsMenuId,
                            "min-w-40 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]",
                            <>
                              <button
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={disableResend}
                                onClick={() => handleResendInvite(row.invite)}
                                type="button"
                              >
                                <span>Resend invite</span>
                                <span>{isResending ? "..." : null}</span>
                              </button>
                              <button
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={disableRevoke}
                                onClick={() => handleRevokeInvite(row.invite)}
                                type="button"
                              >
                                <span>Revoke</span>
                                <span>{isRevoking ? "..." : null}</span>
                              </button>
                            </>,
                          )}
                        </div>
                        <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Expires {formatDate(row.invite.expiresAt)}
                        </div>
                      </td>
                    </tr>
                  );
                }

                const member = row.member;
                const isViewer = member.userId === viewerUserId;
                const roleIsUpdating = roleUpdatingUserId === member.userId;
                const isTransferringOwner = transferringOwnerUserId === member.userId;
                const isRemoving = removingUserId === member.userId;
                const canLeaveHousehold = isViewer && member.role !== "owner";
                const isLeavingHousehold = isViewer && leavingHousehold;
                const canEditOwnerMembers = canManageOwnerRole || member.role !== "owner";
                const canEditMemberRole = canAdministerMembers && canEditOwnerMembers;
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
                const showTransferOwnership =
                  canManageOwnerRole && !isViewer && member.role !== "owner";
                const disableTransferOwnership =
                  roleIsUpdating || isRemoving || isTransferringOwner || !showTransferOwnership;
                const disableLeaveHousehold =
                  !canLeaveHousehold ||
                  roleIsUpdating ||
                  isRemoving ||
                  isTransferringOwner ||
                  isLeavingHousehold;
                const actionsMenuId = `member-${member.userId}`;
                const disableActionsMenu =
                  disableTransferOwnership && disableRemove && disableLeaveHousehold;

                return (
                  <tr
                    key={`member-${member.userId}`}
                    className="border-b border-[var(--stroke-soft)] last:border-b-0 hover:bg-[var(--surface-weak)]"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {member.name?.trim() || "No name"}
                      {isViewer ? (
                        <span className="ml-2 rounded-full border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{member.email}</td>
                    <td className="px-4 py-3">
                      {canEditMemberRole ? (
                        <select
                          className="rounded-lg border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                          value={member.role}
                          onChange={(event) =>
                            handleRoleChange({
                              userId: member.userId,
                              role: toHouseholdMemberRole(event.target.value),
                            })
                          }
                          disabled={disableRoleChange}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          {canManageOwnerRole ? <option value="owner">Owner</option> : null}
                        </select>
                      ) : (
                        <span className="rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {toRoleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(member.joinedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="relative inline-flex justify-end"
                        data-actions-menu-root={actionsMenuId}
                      >
                        <button
                          aria-expanded={openActionsMenuId === actionsMenuId}
                          aria-label="Open member actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-[var(--surface-weak)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disableActionsMenu}
                          onClick={() => toggleActionsMenu(actionsMenuId)}
                          ref={setActionsMenuButtonRef(actionsMenuId)}
                          type="button"
                        >
                          <span className="sr-only">Open member actions</span>
                          <span className="flex items-center gap-0.5 text-[var(--muted)]">
                            <span className="h-1 w-1 rounded-full bg-current" />
                            <span className="h-1 w-1 rounded-full bg-current" />
                            <span className="h-1 w-1 rounded-full bg-current" />
                          </span>
                        </button>
                        {renderActionsMenu(
                          actionsMenuId,
                          "min-w-48 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]",
                          <>
                            <button
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={disableTransferOwnership}
                              onClick={() => handleTransferOwnership(member)}
                              type="button"
                            >
                              <span>Transfer ownership</span>
                              <span>{isTransferringOwner ? "..." : null}</span>
                            </button>
                            <button
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={disableRemove}
                              onClick={() => handleRemove(member)}
                              type="button"
                            >
                              <span>Remove</span>
                              <span>{isRemoving ? "..." : null}</span>
                            </button>
                            {canLeaveHousehold ? (
                              <button
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={disableLeaveHousehold}
                                onClick={handleLeaveHousehold}
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
              })
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
