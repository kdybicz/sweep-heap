export type HouseholdRole = "owner" | "admin" | "member";

export const isHouseholdRole = (role: string): role is HouseholdRole =>
  role === "owner" || role === "admin" || role === "member";

export const normalizeHouseholdRole = (role: string): HouseholdRole =>
  isHouseholdRole(role) ? role : "member";

export const isHouseholdElevatedRole = (role: string) => role === "owner" || role === "admin";
