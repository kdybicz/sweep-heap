import type { DateTime } from "luxon";
import type { Dispatch, SetStateAction } from "react";

export type UseHouseholdWeekModel = {
  weekStartKey: string;
  weekEndKey: string;
  refreshVersion: number;
  timeZone: string;
  setTimeZone: Dispatch<SetStateAction<string>>;
  rangeLabel: string;
  days: DateTime[];
  today: DateTime;
  todayKey: string;
  onResetWeek: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};
