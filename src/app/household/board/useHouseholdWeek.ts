import { DateTime as LuxonDateTime } from "luxon";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatRange,
  getNextHouseholdMidnightDelay,
  startOfWeek,
  toDateKey,
} from "@/app/household/board/date-utils";
import type { UseHouseholdWeekModel } from "@/app/household/board/useHouseholdWeek.types";

export type { UseHouseholdWeekModel } from "@/app/household/board/useHouseholdWeek.types";

export default function useHouseholdWeek(): UseHouseholdWeekModel {
  const [timeZone, setTimeZone] = useState("UTC");
  // null follows the current week; explicit navigation pins a calendar week until Today is clicked.
  const [selectedWeekStartKey, setSelectedWeekStartKey] = useState<string | null>(null);
  const [clock, setClock] = useState(() => ({ now: LuxonDateTime.now(), refreshVersion: 0 }));
  const today = useMemo(() => clock.now.setZone(timeZone).startOf("day"), [clock.now, timeZone]);
  const todayKey = toDateKey(today) ?? "";
  const currentWeekStartKey = toDateKey(startOfWeek(today)) ?? "";
  const weekStartKey = selectedWeekStartKey ?? currentWeekStartKey;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = LuxonDateTime.now();
      setClock((current) => ({ now, refreshVersion: current.refreshVersion + 1 }));
      clearTimeout(timer);
      timer = setTimeout(refresh, getNextHouseholdMidnightDelay(timeZone, now));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [timeZone]);

  const weekStart = useMemo(
    () => LuxonDateTime.fromISO(weekStartKey, { zone: timeZone }).startOf("day"),
    [weekStartKey, timeZone],
  );
  const weekEnd = useMemo(() => weekStart.plus({ days: 6 }), [weekStart]);
  const weekEndKey = toDateKey(weekEnd) ?? "";

  const days = useMemo(() => {
    const totalDays = Math.max(Math.round(weekEnd.diff(weekStart, "days").days) + 1, 1);
    return Array.from({ length: totalDays }, (_, index) => weekStart.plus({ days: index }));
  }, [weekEnd, weekStart]);
  const rangeLabel = formatRange(weekStart);

  const onResetWeek = useCallback(() => {
    setSelectedWeekStartKey(null);
  }, []);

  const onPreviousWeek = useCallback(() => {
    setSelectedWeekStartKey((value) =>
      toDateKey(
        LuxonDateTime.fromISO(value ?? currentWeekStartKey, { zone: timeZone }).minus({ weeks: 1 }),
      ),
    );
  }, [currentWeekStartKey, timeZone]);

  const onNextWeek = useCallback(() => {
    setSelectedWeekStartKey((value) =>
      toDateKey(
        LuxonDateTime.fromISO(value ?? currentWeekStartKey, { zone: timeZone }).plus({ weeks: 1 }),
      ),
    );
  }, [currentWeekStartKey, timeZone]);

  return {
    weekStartKey,
    weekEndKey,
    refreshVersion: clock.refreshVersion,
    timeZone,
    setTimeZone,
    rangeLabel,
    days,
    today,
    todayKey,
    onResetWeek,
    onPreviousWeek,
    onNextWeek,
  };
}
