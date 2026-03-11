import { DateTime } from "luxon";

import type { ChoreItem } from "@/app/household/board/types";

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
  switch (chore.repeat_rule) {
    case "day":
      return "Repeats daily";
    case "week":
      return "Repeats weekly";
    case "biweek":
      return "Repeats every 2 weeks";
    case "month":
      return "Repeats monthly";
    case "year":
      return "Repeats yearly";
    default:
      return null;
  }
};
