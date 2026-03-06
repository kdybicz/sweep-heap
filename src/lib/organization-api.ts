import { APIError } from "better-auth";
import { normalizeHouseholdRole } from "@/lib/household-roles";

type AuthApiErrorLike = {
  code?: string;
  status?: number;
  statusCode?: number;
  message?: string;
  cause?: unknown;
  body?: {
    code?: string;
    message?: string;
    status?: number;
    cause?: unknown;
  };
};

export type AuthApiError = {
  code: string | null;
  statusCode: number | null;
  message: string | null;
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

const INVITATION_NOT_FOUND_CODES = new Set(["INVITATION_NOT_FOUND"]);
const INVITE_RECIPIENT_MISMATCH_CODES = new Set(["YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION"]);
const ALREADY_MEMBER_CODES = new Set(["USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION"]);
const ALREADY_INVITED_CODES = new Set(["USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION"]);
const MEMBER_NOT_FOUND_CODES = new Set(["MEMBER_NOT_FOUND"]);
const LAST_OWNER_CODES = new Set([
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
]);
const OTHER_HOUSEHOLD_CODES = new Set(["USER_IN_OTHER_HOUSEHOLD"]);

const isAuthApiError = (error: unknown): error is AuthApiErrorLike =>
  typeof error === "object" &&
  error !== null &&
  ("code" in error || "statusCode" in error || "body" in error || error instanceof APIError);

const toAuthApiErrorLike = (value: unknown): AuthApiErrorLike | null => {
  if (!isAuthApiError(value)) {
    return null;
  }

  return value;
};

const extractCode = (value: unknown): string | null => {
  const authApiError = toAuthApiErrorLike(value);
  if (!authApiError) {
    return null;
  }

  if (typeof authApiError.code === "string" && authApiError.code) {
    return authApiError.code;
  }

  if (typeof authApiError.body?.code === "string" && authApiError.body.code) {
    return authApiError.body.code;
  }

  const nestedCode = extractCode(authApiError.body?.cause ?? authApiError.cause);
  return nestedCode;
};

const extractStatusCode = (value: unknown): number | null => {
  const authApiError = toAuthApiErrorLike(value);
  if (!authApiError) {
    return null;
  }

  const statusCode =
    authApiError.statusCode ??
    authApiError.body?.status ??
    (typeof authApiError.status === "number" ? authApiError.status : null);

  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    return statusCode;
  }

  return extractStatusCode(authApiError.body?.cause ?? authApiError.cause);
};

const extractMessage = (value: unknown): string | null => {
  const authApiError = toAuthApiErrorLike(value);
  if (!authApiError) {
    return value instanceof Error ? value.message : null;
  }

  if (typeof authApiError.body?.message === "string") {
    return authApiError.body.message;
  }

  if (typeof authApiError.message === "string") {
    return authApiError.message;
  }

  return extractMessage(authApiError.body?.cause ?? authApiError.cause);
};

const hasAuthApiCode = (error: AuthApiError | null, codes: Set<string>) => {
  if (!error?.code) {
    return false;
  }

  return codes.has(error.code);
};

export const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const toAuthApiError = (error: unknown): AuthApiError | null => {
  if (!isAuthApiError(error)) {
    return null;
  }

  return {
    code: extractCode(error),
    statusCode: extractStatusCode(error),
    message: extractMessage(error),
  };
};

export const isInvitationNotFoundError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, INVITATION_NOT_FOUND_CODES) || error?.statusCode === 404;

export const isOtherHouseholdError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, OTHER_HOUSEHOLD_CODES);

export const isInviteRecipientMismatchError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, INVITE_RECIPIENT_MISMATCH_CODES);

export const isAlreadyMemberError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, ALREADY_MEMBER_CODES);

export const isAlreadyInvitedError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, ALREADY_INVITED_CODES);

export const isMemberNotFoundError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, MEMBER_NOT_FOUND_CODES) || error?.statusCode === 404;

export const isLastOwnerError = (error: AuthApiError | null) =>
  hasAuthApiCode(error, LAST_OWNER_CODES);

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
