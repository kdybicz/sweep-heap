"use client";

import { useMemo, useState } from "react";

import {
  formatDate,
  type HouseholdMember,
  type HouseholdMemberRole,
  type HouseholdPendingInvite,
  type HouseholdRow,
  sortMembers,
  sortPendingInvites,
  toRoleLabel,
  toSearchText,
} from "@/app/household/members/members-view-utils";

type HouseholdMembersViewProps = {
  canAdministerMembers: boolean;
  initialMembers: HouseholdMember[];
  initialPendingInvites: HouseholdPendingInvite[];
  viewerUserId: number;
};

export default function HouseholdMembersView({
  canAdministerMembers,
  initialMembers,
  initialPendingInvites,
  viewerUserId,
}: HouseholdMembersViewProps) {
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
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      const data = await response.json();
      if (!data?.ok) {
        if (data?.existingInvite) {
          upsertPendingInvite({
            id: Number(data.existingInvite.id),
            email: String(data.existingInvite.email),
            role: data.existingInvite.role === "admin" ? "admin" : "member",
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
          role: data.invite.role === "admin" ? "admin" : "member",
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
      const data = await response.json();
      if (!data?.ok || !data?.invite) {
        setError(data?.error ?? "Failed to resend invite");
        setResendingInviteId(null);
        return;
      }

      upsertPendingInvite({
        id: Number(data.invite.id),
        email: String(data.invite.email),
        role: data.invite.role === "admin" ? "admin" : "member",
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
      const data = await response.json();
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
      const data = await response.json();
      if (!data?.ok || !data?.member) {
        setError(data?.error ?? "Failed to update member role");
        setRoleUpdatingUserId(null);
        return;
      }

      upsertMember({
        userId: Number(data.member.userId),
        name: typeof data.member.name === "string" ? data.member.name : null,
        email: String(data.member.email),
        role: data.member.role === "admin" ? "admin" : "member",
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
      const data = await response.json();
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
          You can invite new members. Role changes and removals are limited to admins.
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
                  const disableResend = isResending || isRevoking;
                  const disableRevoke = !canAdministerMembers || isResending || isRevoking;

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
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => handleResendInvite(row.invite)}
                            disabled={disableResend}
                          >
                            {isResending ? "Resending..." : "Resend"}
                          </button>
                          {canAdministerMembers ? (
                            <button
                              className="rounded-full border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              onClick={() => handleRevokeInvite(row.invite)}
                              disabled={disableRevoke}
                            >
                              {isRevoking ? "Revoking..." : "Revoke"}
                            </button>
                          ) : null}
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
                const isRemoving = removingUserId === member.userId;
                const disableRoleChange =
                  !canAdministerMembers || isViewer || roleIsUpdating || isRemoving;
                const disableRemove =
                  !canAdministerMembers || isViewer || roleIsUpdating || isRemoving;

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
                      {canAdministerMembers ? (
                        <select
                          className="rounded-lg border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                          value={member.role}
                          onChange={(event) =>
                            handleRoleChange({
                              userId: member.userId,
                              role: event.target.value === "admin" ? "admin" : "member",
                            })
                          }
                          disabled={disableRoleChange}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
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
                      {canAdministerMembers ? (
                        <button
                          className="rounded-full border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          onClick={() => handleRemove(member)}
                          disabled={disableRemove}
                        >
                          {isRemoving ? "Removing..." : "Remove"}
                        </button>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          -
                        </span>
                      )}
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
