"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { recoverFromHouseholdContextError } from "@/app/household/household-context-client";
import {
  createHouseholdMemberInvite,
  leaveHouseholdRequest,
  removeHouseholdMemberRequest,
  resendHouseholdMemberInvite,
  revokeHouseholdMemberInvite,
  toMember,
  toPendingInvite,
  transferHouseholdOwnershipRequest,
  updateHouseholdMemberRoleRequest,
} from "@/app/household/members/household-members-client";
import type { HouseholdMembersViewProps } from "@/app/household/members/household-members-view.types";
import {
  type HouseholdMember,
  type HouseholdMemberRole,
  type HouseholdPendingInvite,
  type HouseholdRow,
  sortMembers,
  sortPendingInvites,
  toSearchText,
} from "@/app/household/members/members-view-utils";

export const useHouseholdMembersActions = ({
  closeActionsMenu,
  initialMembers,
  initialPendingInvites,
  viewerUserId,
}: Pick<HouseholdMembersViewProps, "initialMembers" | "initialPendingInvites" | "viewerUserId"> & {
  closeActionsMenu: () => void;
}) => {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const viewerRole = members.find((member) => member.userId === viewerUserId)?.role ?? "member";
  const viewerIsOwner = viewerRole === "owner";

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

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const toggleInviteOpen = () => {
    setInviteOpen((isOpen) => !isOpen);
    clearFeedback();
  };

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
    clearFeedback();
    setInviteSubmitting(true);

    try {
      const data = await createHouseholdMemberInvite(inviteEmail);
      closeActionsMenu();
      if (!data) {
        setError("Failed to invite member");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        if (data.existingInvite) {
          upsertPendingInvite(toPendingInvite(data.existingInvite));
        }
        setError(data.error || "Failed to invite member");
        return;
      }

      upsertPendingInvite(toPendingInvite(data.invite));
      setInviteEmail("");
      setInviteOpen(false);
      setMessage(
        data.inviteEmailSent
          ? `Invite sent to ${data.invite.email}.`
          : "Invite created, but email delivery failed.",
      );
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Failed to invite member");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleResendInvite = async (invite: HouseholdPendingInvite) => {
    clearFeedback();
    setResendingInviteId(invite.id);

    try {
      const data = await resendHouseholdMemberInvite(invite.id);
      closeActionsMenu();
      if (!data) {
        setError("Failed to resend invite");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to resend invite");
        return;
      }

      upsertPendingInvite(toPendingInvite(data.invite));
      setMessage(
        data.inviteEmailSent
          ? `Invite resent to ${data.invite.email}.`
          : "Invite refreshed, but email delivery failed.",
      );
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Failed to resend invite");
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRevokeInvite = async (invite: HouseholdPendingInvite) => {
    const confirmed = window.confirm(`Revoke pending invite for ${invite.email}?`);
    if (!confirmed) {
      return;
    }

    clearFeedback();
    setRevokingInviteId(invite.id);

    try {
      const data = await revokeHouseholdMemberInvite(invite.id);
      closeActionsMenu();
      if (!data) {
        setError("Failed to revoke invite");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to revoke invite");
        return;
      }

      setPendingInvites((previousInvites) =>
        previousInvites.filter((existingInvite) => existingInvite.id !== invite.id),
      );
      setMessage("Invite revoked.");
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke invite");
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
    clearFeedback();
    setRoleUpdatingUserId(userId);

    try {
      const data = await updateHouseholdMemberRoleRequest({ userId, role });
      closeActionsMenu();
      if (!data) {
        setError("Failed to update member role");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to update member role");
        return;
      }

      upsertMember(toMember(data.member));
      setMessage("Member role updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update member role");
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

    clearFeedback();
    setRemovingUserId(member.userId);

    try {
      const data = await removeHouseholdMemberRequest(member.userId);
      closeActionsMenu();
      if (!data) {
        setError("Failed to remove member");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to remove member");
        return;
      }

      setMembers((previousMembers) =>
        previousMembers.filter((existingMember) => existingMember.userId !== member.userId),
      );
      setMessage("Member removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove member");
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

    closeActionsMenu();
    clearFeedback();
    setTransferringOwnerUserId(member.userId);

    try {
      const data = await transferHouseholdOwnershipRequest(member.userId);
      if (!data) {
        setError("Failed to transfer ownership");
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to transfer ownership");
        return;
      }

      for (const updatedMember of data.members) {
        upsertMember(toMember(updatedMember));
      }

      setMessage(`Ownership transferred to ${memberLabel}.`);
      router.refresh();
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "Failed to transfer ownership",
      );
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

    closeActionsMenu();
    clearFeedback();
    setLeavingHousehold(true);

    try {
      const data = await leaveHouseholdRequest();
      if (!data) {
        setError("Failed to leave household");
        setLeavingHousehold(false);
        return;
      }
      if (recoverFromHouseholdContextError(data)) {
        return;
      }
      if (!data.ok) {
        setError(data.error || "Failed to leave household");
        setLeavingHousehold(false);
        return;
      }

      router.push(data.nextPath || "/household/setup");
      router.refresh();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Failed to leave household");
      setLeavingHousehold(false);
    }
  };

  return {
    viewerIsOwner,
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
  };
};
