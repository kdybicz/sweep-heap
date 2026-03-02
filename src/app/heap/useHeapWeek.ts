import type { DateTime } from "luxon";
import { DateTime as LuxonDateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatRange, getHouseholdToday, startOfWeek, toDateKey } from "@/app/heap/date-utils";
import type { UseHeapWeekModel } from "@/app/heap/useHeapWeek.types";

export type { UseHeapWeekModel } from "@/app/heap/useHeapWeek.types";

export default function useHeapWeek(): UseHeapWeekModel {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timeZone, setTimeZone] = useState("UTC");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const baseDateRef = useRef<DateTime | null>(null);

  if (!baseDateRef.current) {
    baseDateRef.current = getHouseholdToday(timeZone);
  }

  useEffect(() => {
    baseDateRef.current = getHouseholdToday(timeZone);
  }, [timeZone]);

  const weekStart = useMemo(() => {
    if (rangeStart) {
      return LuxonDateTime.fromISO(rangeStart, { zone: timeZone }).startOf("day");
    }
    const baseDate = baseDateRef.current ?? getHouseholdToday(timeZone);
    return startOfWeek(baseDate).plus({ weeks: weekOffset });
  }, [rangeStart, timeZone, weekOffset]);

  const weekEnd = useMemo(() => {
    if (rangeEnd) {
      return LuxonDateTime.fromISO(rangeEnd, { zone: timeZone }).startOf("day");
    }
    return weekStart.plus({ days: 6 });
  }, [rangeEnd, timeZone, weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index })),
    [weekStart],
  );
  const rangeLabel = formatRange(weekStart, weekEnd);
  const today = useMemo(() => getHouseholdToday(timeZone), [timeZone]);
  const todayKey = useMemo(() => toDateKey(today) ?? "", [today]);

  const onResetWeek = useCallback(() => {
    setWeekOffset(0);
  }, []);

  const onPreviousWeek = useCallback(() => {
    setWeekOffset((value) => value - 1);
  }, []);

  const onNextWeek = useCallback(() => {
    setWeekOffset((value) => value + 1);
  }, []);

  return {
    weekOffset,
    timeZone,
    setTimeZone,
    setRangeStart,
    setRangeEnd,
    rangeLabel,
    days,
    today,
    todayKey,
    onResetWeek,
    onPreviousWeek,
    onNextWeek,
  };
}
