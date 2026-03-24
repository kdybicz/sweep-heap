export type HouseholdRole = "owner" | "admin" | "member";

export type HouseholdChorePermissionContext = {
  role: string;
  membersCanManageChores?: boolean;
};

export const isHouseholdRole = (role: string): role is HouseholdRole =>
  role === "owner" || role === "admin" || role === "member";

export const normalizeHouseholdRole = (role: string): HouseholdRole =>
  isHouseholdRole(role) ? role : "member";

export const isHouseholdElevatedRole = (role: string) => role === "owner" || role === "admin";

export const canManageHouseholdChores = ({
  role,
  membersCanManageChores,
}: HouseholdChorePermissionContext) => {
  return isHouseholdElevatedRole(role) || membersCanManageChores !== false;
};
