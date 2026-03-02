import { useCallback, useEffect, useRef, useState } from "react";

import type { ChoreItem } from "@/app/heap/types";
import type {
  LoadChoresFn,
  UseHeapChoresDataModel,
  UseHeapChoresDataParams,
} from "@/app/heap/useHeapChoresData.types";

export type {
  LoadChoresFn,
  UseHeapChoresDataModel,
  UseHeapChoresDataParams,
} from "@/app/heap/useHeapChoresData.types";

export default function useHeapChoresData({
  weekOffset,
  todayKey,
  setTimeZone,
  setRangeStart,
  setRangeEnd,
}: UseHeapChoresDataParams): UseHeapChoresDataModel {
  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayChores, setTodayChores] = useState<ChoreItem[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const lastRangeRef = useRef<string | null>(null);

  const loadChores = useCallback<LoadChoresFn>(
    async ({ force }: { force?: boolean } = {}) => {
      if (!force && lastRangeRef.current === String(weekOffset)) {
        return;
      }
      lastRangeRef.current = String(weekOffset);

      try {
        setLoading(true);
        const response = await fetch(`/api/chores?weekOffset=${weekOffset}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (data?.ok) {
          setChores(data.chores ?? []);
          if (data.timeZone) {
            setTimeZone((current) => (data.timeZone !== current ? data.timeZone : current));
          }
          if (data.rangeStart && data.rangeEnd) {
            setRangeStart(data.rangeStart);
            setRangeEnd(data.rangeEnd);
          }
        } else if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [setRangeEnd, setRangeStart, setTimeZone, weekOffset],
  );

  useEffect(() => {
    void loadChores();
  }, [loadChores]);

  const loadTodayChores = useCallback(async () => {
    try {
      setLoadingToday(true);
      const response = await fetch(`/api/chores?start=${todayKey}&end=${todayKey}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (data?.error === "Household required") {
        window.location.assign("/household/setup");
        return;
      }
      if (data?.ok) {
        setTodayChores(data.chores ?? []);
        if (data.timeZone) {
          setTimeZone((current) => (data.timeZone !== current ? data.timeZone : current));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingToday(false);
    }
  }, [setTimeZone, todayKey]);

  useEffect(() => {
    void loadTodayChores();
  }, [loadTodayChores]);

  return {
    chores,
    setChores,
    loading,
    todayChores,
    loadingToday,
    loadChores,
    loadTodayChores,
  };
}
