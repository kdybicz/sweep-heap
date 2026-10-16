import { DateTime } from "luxon";

export const MAX_CHORE_QUERY_DAYS = 31;
export const MAX_CHORE_DURATION_DAYS = 366;
export const MAX_CHORE_GENERATED_ENTRIES = 10_000;
export const MAX_CHORE_GENERATION_STEPS = 50_000;
export const MAX_CHORE_QUERY_ROWS = 10_000;
export const MAX_CHORE_EXCEPTION_MIGRATIONS = 10_000;
export const MAX_CHORE_WEEK_OFFSET = 520;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const isValidChoreDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = DateTime.fromISO(value, { zone: "UTC" });
  return date.isValid && date.year >= 1 && date.year <= 9999 && date.toISODate() === value;
};

/** Accept complete civil dates or ISO calendar timestamps, not reduced/week/ordinal dates. */
export const isValidChoreDateInput = (value: unknown) => {
  if (value instanceof Date) {
    const date = DateTime.fromJSDate(value, { zone: "UTC" });
    return date.isValid && date.year >= 1 && date.year <= 9999;
  }
  if (isValidChoreDateKey(value)) return true;
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !isValidChoreDateKey(value.slice(0, 10))
  )
    return false;
  const offset = value.match(/[+-](\d{2})(?::?(\d{2}))?(?:\[[^\]]+\])?$/);
  if (offset && (Number(offset[1]) > 23 || Number(offset[2] ?? 0) > 59)) return false;
  const date = DateTime.fromISO(value, { zone: "UTC", setZone: true });
  return date.isValid && isValidChoreDateKey(date.toISODate());
};

export const normalizeChoreDate = (value: unknown, timeZone: string): string | null => {
  if (!isValidChoreDateInput(value)) return null;
  if (isValidChoreDateKey(value)) return value;
  const parsed =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: timeZone })
      : DateTime.fromISO(value as string, { zone: timeZone });
  const key = parsed.isValid ? parsed.toISODate() : null;
  return isValidChoreDateKey(key) ? key : null;
};

export class ChoreDateValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Validation failed");
    this.name = "ChoreDateValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export const getChoreDateSpanErrors = (startDate: string | null, endDate: string | null) => {
  const errors: Record<string, string> = {};
  const startValid = isValidChoreDateKey(startDate);
  const endValid = isValidChoreDateKey(endDate);
  if (startDate !== null && !startValid) errors.startDate = "Invalid start date";
  if (endDate !== null && !endValid) errors.endDate = "Invalid end date";
  if (startValid && endValid) {
    const days = DateTime.fromISO(endDate, { zone: "UTC" }).diff(
      DateTime.fromISO(startDate, { zone: "UTC" }),
      "days",
    ).days;
    if (days <= 0) errors.endDate = "End date must be after start date";
    else if (days > MAX_CHORE_DURATION_DAYS)
      errors.endDate = `Chore duration must be at most ${MAX_CHORE_DURATION_DAYS} days`;
  }
  return errors;
};

export const getChoreQueryRangeErrors = (start: string | null, end: string | null) => {
  const errors: Record<string, string> = {};
  const startValid = isValidChoreDateKey(start);
  const endValid = isValidChoreDateKey(end);
  if (!startValid) errors.start = "Invalid start date";
  if (!endValid) errors.end = "Invalid end date";
  if (startValid && endValid) {
    const days =
      DateTime.fromISO(end, { zone: "UTC" }).diff(DateTime.fromISO(start, { zone: "UTC" }), "days")
        .days + 1;
    if (days < 1) errors.end = "End date must be on or after start date";
    else if (days > MAX_CHORE_QUERY_DAYS)
      errors.end = `Date range must contain at most ${MAX_CHORE_QUERY_DAYS} days`;
  }
  return errors;
};

export const getChoreQueryInputErrors = (start: string | null, end: string | null) => {
  const errors: Record<string, string> = {};
  if ((start === null) !== (end === null))
    errors[start === null ? "start" : "end"] = "Start and end must be supplied together";
  if (start !== null && !isValidChoreDateInput(start)) errors.start = "Invalid start date";
  if (end !== null && !isValidChoreDateInput(end)) errors.end = "Invalid end date";
  // Literal date ranges can be rejected without loading household timezone metadata.
  if (isValidChoreDateKey(start) && isValidChoreDateKey(end))
    Object.assign(errors, getChoreQueryRangeErrors(start, end));
  return errors;
};

export const getChorePatchDateErrors = (payload: Record<string, unknown>, timeZone?: string) => {
  const errors: Record<string, string> = {};
  const action = payload.action ?? "set";
  const valid = (value: unknown, zone: string) =>
    timeZone === undefined
      ? isValidChoreDateInput(value)
      : normalizeChoreDate(value, zone) !== null;
  if (
    action !== "create" &&
    payload.occurrenceStartDate !== undefined &&
    payload.occurrenceStartDate !== null &&
    payload.occurrenceStartDate !== "" &&
    !valid(payload.occurrenceStartDate, "UTC")
  )
    errors.occurrenceStartDate = "Invalid occurrence start date";
  if (action === "create" || action === "edit") {
    for (const [field, message] of [
      ["startDate", "Invalid start date"],
      ["endDate", "Invalid end date"],
    ]) {
      const value = payload[field];
      if (value === undefined || (action === "create" && (value === null || value === "")))
        continue;
      if (!valid(value, timeZone ?? "UTC")) errors[field] = message;
    }
    if (
      payload.seriesEndDate !== undefined &&
      payload.seriesEndDate !== null &&
      !valid(payload.seriesEndDate, timeZone ?? "UTC")
    )
      errors.repeatEnd = "Invalid repeat end date";
  }
  return errors;
};
