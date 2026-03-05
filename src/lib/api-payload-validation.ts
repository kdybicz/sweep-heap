import { z } from "zod";

import type { HouseholdMemberRole } from "@/lib/repositories/household-repository";

export type PayloadValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
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
  .refine((value) => Number.isFinite(value), {
    message: "Member user id is required",
  });

const householdMemberRoleSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value : ""))
  .refine((value): value is HouseholdMemberRole => value === "admin" || value === "member", {
    message: "Role must be admin or member",
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

const allowedActions = new Set(["create", "set", "undo"]);

const choreActionSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : null))
  .refine((value) => value === null || allowedActions.has(value), {
    message: "Action must be create, set, or undo",
  });

const choreStatusSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim().toLowerCase() : null));

const chorePatchPayloadSchema = z
  .object({
    action: choreActionSchema.optional(),
    status: choreStatusSchema.optional(),
  })
  .catchall(z.unknown())
  .superRefine((payload, ctx) => {
    const action = payload.action ?? null;
    const status = payload.status ?? null;
    if ((action ?? "set") === "set" && status !== "open" && status !== "closed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Status must be open or closed",
        path: ["status"],
      });
    }
  })
  .transform((payload) => payload as Record<string, unknown>);

export const validateHouseholdInvitePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ email: string }> =>
  toValidationResult(householdInvitePayloadSchema.safeParse(payload));

export const validateHouseholdMemberRoleUpdatePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ userId: number; role: HouseholdMemberRole }> =>
  toValidationResult(householdMemberRoleUpdatePayloadSchema.safeParse(payload));

export const validateHouseholdMemberRemovePayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<{ userId: number }> =>
  toValidationResult(householdMemberRemovePayloadSchema.safeParse(payload));

export const validateChorePatchPayload = (
  payload: Record<string, unknown>,
): PayloadValidationResult<Record<string, unknown>> =>
  toValidationResult(chorePatchPayloadSchema.safeParse(payload));
