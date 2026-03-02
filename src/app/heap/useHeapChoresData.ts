import { useCallback, useEffect, useRef, useState } from "react";

import type { ChoreItem } from "@/app/heap/types";
import type {
  FetchChoresFn,
  LoadChoresFn,
  LoadWeekChoresRequestParams,
  UseHeapChoresDataModel,
  UseHeapChoresDataParams,
} from "@/app/heap/useHeapChoresData.types";

export type {
  FetchChoresFn,
  LoadChoresFn,
  LoadWeekChoresRequestParams,
  UseHeapChoresDataModel,
  UseHeapChoresDataParams,
} from "@/app/heap/useHeapChoresData.types";

type LoadWeekChoresResponse = {
  ok?: boolean;
  chores?: ChoreItem[];
  timeZone?: string;
  rangeStart?: string;
  rangeEnd?: string;
  error?: string;
};

const isAbortError = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return typeof error === "object" && error !== null && "name" in error
    ? (error as { name?: unknown }).name === "AbortError"
    : false;
};

export async function loadWeekChoresRequest({
  weekOffset,
  force,
  fetchImpl = fetch as FetchChoresFn,
  lastLoadedOffsetRef,
  requestIdRef,
  activeControllerRef,
  setLoading,
  setChores,
  setTimeZone,
  setRangeStart,
  setRangeEnd,
  onHouseholdRequired,
  onError,
}: LoadWeekChoresRequestParams): Promise<void> {
  const weekOffsetKey = String(weekOffset);
  if (!force && lastLoadedOffsetRef.current === weekOffsetKey) {
    if (activeControllerRef.current) {
      requestIdRef.current += 1;
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }
    setLoading(false);
    return;
  }

  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;
  activeControllerRef.current?.abort();
  const controller = new AbortController();
  activeControllerRef.current = controller;

  try {
    setLoading(true);
    const response = await fetchImpl(`/api/chores?weekOffset=${weekOffset}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json()) as LoadWeekChoresResponse;
    if (requestId !== requestIdRef.current) {
      return;
    }

    if (data?.ok) {
      setChores(data.chores ?? []);
      const nextTimeZone = data.timeZone;
      if (nextTimeZone) {
        setTimeZone((current) => (nextTimeZone !== current ? nextTimeZone : current));
      }
      if (data.rangeStart && data.rangeEnd) {
        setRangeStart(data.rangeStart);
        setRangeEnd(data.rangeEnd);
      }
      lastLoadedOffsetRef.current = weekOffsetKey;
    } else if (data?.error === "Household required") {
      onHouseholdRequired();
    }
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return;
    }
    if (isAbortError(error)) {
      return;
    }
    onError(error);
  } finally {
    if (requestId === requestIdRef.current) {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      setLoading(false);
    }
  }
}

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
  const lastLoadedOffsetRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const loadChores = useCallback<LoadChoresFn>(
    async ({ force }: { force?: boolean } = {}) => {
      await loadWeekChoresRequest({
        weekOffset,
        force,
        lastLoadedOffsetRef,
        requestIdRef,
        activeControllerRef,
        setLoading,
        setChores,
        setTimeZone,
        setRangeStart,
        setRangeEnd,
        onHouseholdRequired: () => {
          window.location.assign("/household/setup");
        },
        onError: (error) => {
          console.error(error);
        },
      });
    },
    [setRangeEnd, setRangeStart, setTimeZone, weekOffset],
  );

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

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
