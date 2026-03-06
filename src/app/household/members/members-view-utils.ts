import {
  type HouseholdRole as HouseholdMemberRole,
  normalizeHouseholdRole,
} from "@/lib/household-roles";

export type { HouseholdMemberRole };

export type HouseholdMember = {
  userId: number;
  name: string | null;
  email: string;
  role: HouseholdMemberRole;
  joinedAt: string;
};

export type HouseholdPendingInvite = {
  id: number;
  email: string;
  role: HouseholdMemberRole;
  createdAt: string;
  expiresAt: string;
};

export type HouseholdRow =
  | { kind: "member"; member: HouseholdMember }
  | { kind: "invite"; invite: HouseholdPendingInvite };

export const sortMembers = (members: HouseholdMember[]) =>
  [...members].sort((a, b) => {
    const aName = (a.name?.trim() || a.email).toLowerCase();
    const bName = (b.name?.trim() || b.email).toLowerCase();
    const byName = aName.localeCompare(bName);
    if (byName !== 0) {
      return byName;
    }
    return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
  });

export const sortPendingInvites = (invites: HouseholdPendingInvite[]) =>
  [...invites].sort((a, b) => {
    const byCreated = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (byCreated !== 0) {
      return byCreated;
    }
    return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
  });

export const toHouseholdMemberRole = (role: unknown): HouseholdMemberRole =>
  typeof role === "string" ? normalizeHouseholdRole(role) : "member";

export const toRoleLabel = (role: HouseholdMemberRole) =>
  role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member";

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

export const toSearchText = (row: HouseholdRow) => {
  if (row.kind === "member") {
    return `${row.member.name ?? ""} ${row.member.email} ${row.member.role} member`.toLowerCase();
  }
  return `${row.invite.email} ${row.invite.role} pending invite`.toLowerCase();
};
