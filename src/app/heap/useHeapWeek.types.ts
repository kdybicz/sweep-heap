import type { DateTime } from "luxon";
import type { Dispatch, SetStateAction } from "react";

export type UseHeapWeekModel = {
  weekOffset: number;
  timeZone: string;
  setTimeZone: Dispatch<SetStateAction<string>>;
  setRangeStart: Dispatch<SetStateAction<string | null>>;
  setRangeEnd: Dispatch<SetStateAction<string | null>>;
  rangeLabel: string;
  days: DateTime[];
  today: DateTime;
  todayKey: string;
  onResetWeek: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};
