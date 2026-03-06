import { APIError } from "better-auth";
import { normalizeHouseholdRole } from "@/lib/household-roles";

type AuthApiErrorLike = {
  statusCode?: number;
  body?: {
    message?: string;
  };
};

export type OrganizationMemberLike = {
  id: string | number;
  userId: string | number;
  role: string;
  createdAt: Date | string;
  user?: {
    name?: string | null;
    email?: string | null;
  };
};

export type OrganizationInvitationLike = {
  id: string | number;
  email: string;
  role: string;
  status: string;
  createdAt: Date | string;
  expiresAt: Date | string;
};

const INVITATION_NOT_FOUND_MESSAGES = new Set(["Invitation not found", "Invitation not found!"]);

const LAST_OWNER_MESSAGES = new Set([
  "You cannot leave the organization with without an owner",
  "You cannot leave the organization as the only owner",
]);

const isAuthApiError = (error: unknown): error is AuthApiErrorLike =>
  typeof error === "object" &&
  error !== null &&
  ("statusCode" in error || "body" in error || error instanceof APIError);

export const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const toAuthApiErrorMessage = (error: unknown) => {
  if (!isAuthApiError(error)) {
    return null;
  }

  if (typeof error.body?.message === "string") {
    return error.body.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
};

export const isInvitationNotFoundError = (message: string | null) =>
  typeof message === "string" && INVITATION_NOT_FOUND_MESSAGES.has(message);

export const isOtherHouseholdError = (message: string | null) =>
  message === "You already belong to another household";

export const isInviteRecipientMismatchError = (message: string | null) =>
  message === "You are not the recipient of the invitation";

export const isAlreadyMemberError = (message: string | null) =>
  message === "User is already a member of this organization";

export const isAlreadyInvitedError = (message: string | null) =>
  message === "User is already invited to this organization";

export const isMemberNotFoundError = (message: string | null) => message === "Member not found";

export const isLastOwnerError = (message: string | null) =>
  typeof message === "string" && LAST_OWNER_MESSAGES.has(message);

const toMemberRole = (role: string) => normalizeHouseholdRole(role);

export const mapOrganizationMember = (member: OrganizationMemberLike) => {
  const userId = parsePositiveInt(member.userId);
  if (userId === null) {
    throw new Error("Invalid member user id");
  }

  return {
    userId,
    name: typeof member.user?.name === "string" ? member.user.name : null,
    email: member.user?.email ?? "",
    role: toMemberRole(member.role),
    joinedAt: member.createdAt,
  };
};

export const mapOrganizationInvitation = (invitation: OrganizationInvitationLike) => {
  const id = parsePositiveInt(invitation.id);
  if (id === null) {
    throw new Error("Invalid invite id");
  }

  return {
    id,
    email: invitation.email,
    role: toMemberRole(invitation.role),
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
};
