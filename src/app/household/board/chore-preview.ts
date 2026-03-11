import { DateTime } from "luxon";

import { addDaysToDateKey, subtractDaysFromDateKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";

export type PreviewRepeatValue = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export type PreviewRepeatEndMode = "never" | "on_date";

export type ChorePreviewFormState = {
  startDate: string;
  endDate: string;
  repeat: PreviewRepeatValue;
  repeatEndMode: PreviewRepeatEndMode;
  repeatEnd: string;
};

export const getPreviewRepeatValue = (
  repeatRule: string | null | undefined,
): PreviewRepeatValue => {
  switch (repeatRule) {
    case "day":
      return "daily";
    case "week":
      return "weekly";
    case "biweek":
      return "biweekly";
    case "month":
      return "monthly";
    case "year":
      return "yearly";
    default:
      return "none";
  }
};

export const getChorePreviewFormState = (chore: ChoreItem): ChorePreviewFormState => {
  const startDate = chore.occurrence_start_date;
  const endDate = subtractDaysFromDateKey(addDaysToDateKey(startDate, chore.duration_days ?? 1), 1);

  return {
    startDate,
    endDate,
    repeat: getPreviewRepeatValue(chore.repeat_rule),
    repeatEndMode: chore.series_end_date ? "on_date" : "never",
    repeatEnd: chore.series_end_date ?? endDate,
  };
};

export const getChorePreviewDateLabel = (chore: ChoreItem) => {
  const durationDays = chore.duration_days ?? 1;
  const occurrenceStart = DateTime.fromISO(chore.occurrence_start_date);
  const occurrenceEnd = occurrenceStart.plus({ days: durationDays - 1 });

  if (durationDays <= 1) {
    return occurrenceStart.toFormat("d LLL yyyy");
  }

  return `${occurrenceStart.toFormat("d LLL yyyy")} - ${occurrenceEnd.toFormat("d LLL yyyy")}`;
};

export const getChorePreviewRepeatLabel = (chore: ChoreItem) => {
  switch (getPreviewRepeatValue(chore.repeat_rule)) {
    case "daily":
      return "Repeats daily";
    case "weekly":
      return "Repeats weekly";
    case "biweekly":
      return "Repeats every 2 weeks";
    case "monthly":
      return "Repeats monthly";
    case "yearly":
      return "Repeats yearly";
    default:
      return null;
  }
};
