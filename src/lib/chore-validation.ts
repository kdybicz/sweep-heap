import { getChoreDateSpanErrors, isValidChoreDateKey } from "@/lib/chore-date-validation";

export type StoredChoreValidationInput = {
  title: string;
  type: string;
  startDate: string | null;
  exclusiveEndDate: string | null;
  repeatRule: string;
  seriesEndDate: string | null;
};

const allowedRepeatRules = new Set(["none", "day", "week", "biweek", "month", "year"]);
const allowedChoreTypes = new Set(["close_on_done", "stay_open"]);

export const normalizeRepeatRule = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "daily") return "day";
  if (normalized === "weekly") return "week";
  if (normalized === "biweekly") return "biweek";
  if (normalized === "monthly") return "month";
  if (normalized === "yearly") return "year";
  return normalized;
};

export const validateChoreCreate = ({
  title,
  type,
  startDate,
  exclusiveEndDate,
  repeatRule,
  seriesEndDate,
}: StoredChoreValidationInput) => {
  const fieldErrors: Record<string, string> = {};

  if (!title) {
    fieldErrors.title = "Title is required";
  }
  if (!allowedChoreTypes.has(type)) {
    fieldErrors.type = "Invalid chore type";
  }
  if (!startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (!exclusiveEndDate) {
    fieldErrors.endDate = "End date is required";
  }
  Object.assign(fieldErrors, getChoreDateSpanErrors(startDate || null, exclusiveEndDate || null));
  if (!allowedRepeatRules.has(repeatRule)) {
    fieldErrors.repeatRule = "Invalid repeat rule";
  }
  if (seriesEndDate !== null && !isValidChoreDateKey(seriesEndDate))
    fieldErrors.repeatEnd = "Invalid repeat end date";
  if (repeatRule === "none" && seriesEndDate && isValidChoreDateKey(seriesEndDate)) {
    fieldErrors.repeatEnd = "Repeat end is only allowed when repeating";
  }
  if (
    isValidChoreDateKey(seriesEndDate) &&
    isValidChoreDateKey(startDate) &&
    seriesEndDate < startDate
  ) {
    fieldErrors.repeatEnd = "Repeat end must be on or after start date";
  }

  return fieldErrors;
};
