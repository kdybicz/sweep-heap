import { z } from "zod";

import { API_ERROR_CODE, type ApiErrorCode } from "@/lib/api-error";
import { type HouseholdRole, isHouseholdRole } from "@/lib/household-roles";

export type PayloadValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export type ChorePatchAction = "create" | "set" | "cancel" | "edit";
export type ChorePatchScope = "single" | "following" | "all";
export type ChorePatchPayload = Record<string, unknown> & {
  action?: string | null;
  status?: string | null;
  scope?: string | null;
};
export type ChorePatchValidationResult =
  | {
      ok: true;
      data: ChorePatchPayload;
    }
  | {
      ok: false;
      error: string;
      code: ApiErrorCode;
    };

type ChorePatchIntentValidationError = {
  path: "action" | "status" | "scope";
  message: string;
};

const toValidationResult = <T>(
  result:
    | {
        success: true;
        data: T;
      }
    | {
        success: false;
        error: z.ZodError<T>;
      },
): PayloadValidationResult<T> => {
  if (result.success) {
    return {
      ok: true,
      data: result.data,
    };
  }

  return {
    ok: false,
    error: result.error.issues[0]?.message ?? "Invalid request body",
  };
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const householdMemberEmailSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
  .refine((value) => value.length > 0 && isValidEmail(value), {
    message: "Valid email is required",
  });

const householdMemberUserIdSchema = z
  .unknown()
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "Member user id is required",
  });

const householdInviteIdSchema = z
  .unknown()
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "Invitation id and secret are required",
  });

const householdInviteSecretSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine((value) => value.length > 0, {
    message: "Invitation id and secret are required",
  });

const householdMemberRoleSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value : ""))
  .refine((value): value is HouseholdRole => isHouseholdRole(value), {
    message: "Role must be owner, admin, or member",
  });

const householdInvitePayloadSchema = z.object({
  email: householdMemberEmailSchema,
});

const householdMemberRoleUpdatePayloadSchema = z.object({
  userId: householdMemberUserIdSchema,
  role: householdMemberRoleSchema,
});

const householdMemberRemovePayloadSchema = z.object({
  userId: householdMemberUserIdSchema,
});

const householdOwnerTransferPayloadSchema = z.object({
  userId: householdMemberUserIdSchema,
});

const householdInviteAcceptPayloadSchema = z.object({
  invitationId: householdInviteIdSchema,
  secret: householdInviteSecretSchema,
});

const allowedActions = new Set(["create", "set", "cancel", "edit"]);
const allowedScopes = new Set(["single", "following", "all"]);

export const validateChorePatchIntent = (
  payload: Pick<ChorePatchPayload, "action" | "status" | "scope">,
): ChorePatchIntentValidationError | null => {
  const action = payload.action ?? null;
  const status = payload.status ?? null;
  const scope = payload.scope ?? null;

  if (action !== null && !allowedActions.has(action)) {
    return {
      path: "action",
      message: "Action must be create, set, cancel, or edit",
    };
  }

  if ((action ?? "set") === "set" && status !== "open" && status !== "closed") {
    return {
      path: "status",
      message: "Status must be open or closed",
    };
  }

  if ((action === "cancel" || action === "edit") && !allowedScopes.has(scope ?? "")) {
    return {
      path: "scope",
      message: "scope must be single, following, or all",
    };
  }

  return null;
};

const choreActionSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : null));

const choreStatusSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : null));

const chorePatchPayloadSchema = z
  .object({
    action: choreActionSchema.optional(),
    status: choreStatusSchema.optional(),
    scope: z
      .unknown()
      .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : null))
      .optional(),
  })
  .catchall(z.unknown())
  .superRefine((payload, ctx) => {
    const validationError = validateChorePatchIntent(payload);
    if (validationError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validationError.message,
        path: [validationError.path],
      });
    }
  })
  .transform((payload) => payload as ChorePatchPayload);

export const validateHouseholdInvitePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ email: string }> =>
  toValidationResult(householdInvitePayloadSchema.safeParse(payload));

export const validateHouseholdMemberRoleUpdatePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ userId: number; role: HouseholdRole }> =>
  toValidationResult(householdMemberRoleUpdatePayloadSchema.safeParse(payload));

export const validateHouseholdMemberRemovePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ userId: number }> =>
  toValidationResult(householdMemberRemovePayloadSchema.safeParse(payload));

export const validateHouseholdOwnerTransferPayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ userId: number }> =>
  toValidationResult(householdOwnerTransferPayloadSchema.safeParse(payload));

export const validateHouseholdInviteAcceptPayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ invitationId: number; secret: string }> =>
  toValidationResult(householdInviteAcceptPayloadSchema.safeParse(payload));

export const validateChorePatchPayload = (
  payload: Record<string, unknown>,
): ChorePatchValidationResult => {
  const result = chorePatchPayloadSchema.safeParse(payload);
  if (result.success) {
    return {
      ok: true,
      data: result.data,
    };
  }

  const firstIssue = result.error.issues[0];
  const issuePath = firstIssue?.path[0];
  const code =
    issuePath === "action"
      ? API_ERROR_CODE.ACTION_INVALID
      : issuePath === "status"
        ? API_ERROR_CODE.STATUS_INVALID
        : issuePath === "scope"
          ? API_ERROR_CODE.CANCEL_SCOPE_INVALID
          : API_ERROR_CODE.VALIDATION_FAILED;

  return {
    ok: false,
    code,
    error: firstIssue?.message ?? "Invalid request body",
  };
};
