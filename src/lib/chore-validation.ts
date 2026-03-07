export type CreateChoreInput = {
  title: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  repeatRule: string;
  seriesEndDate: string | null;
  today?: string;
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
  endDate,
  repeatRule,
  seriesEndDate,
  today,
}: CreateChoreInput) => {
  const fieldErrors: Record<string, string> = {};
  const todayValue = today ?? null;

  if (!todayValue) {
    fieldErrors.today = "Missing household-local today value";
  }

  if (!title) {
    fieldErrors.title = "Title is required";
  }
  if (!allowedChoreTypes.has(type)) {
    fieldErrors.type = "Invalid chore type";
  }
  if (!startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (!endDate) {
    fieldErrors.endDate = "End date is required";
  }
  if (todayValue && startDate && startDate < todayValue) {
    fieldErrors.startDate = "Start date cannot be in the past";
  }
  if (todayValue && endDate && endDate < todayValue) {
    fieldErrors.endDate = "End date cannot be in the past";
  }
  if (startDate && endDate && endDate <= startDate) {
    fieldErrors.endDate = "End date must be after start date";
  }
  if (!allowedRepeatRules.has(repeatRule)) {
    fieldErrors.repeatRule = "Invalid repeat rule";
  }
  if (repeatRule === "none" && seriesEndDate) {
    fieldErrors.repeatEnd = "Repeat end is only allowed when repeating";
  }
  if (seriesEndDate && startDate && seriesEndDate < startDate) {
    fieldErrors.repeatEnd = "Repeat end must be on or after start date";
  }

  return fieldErrors;
};
