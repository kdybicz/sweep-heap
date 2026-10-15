import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo } from "react";
import {
  type ChoresQueryData,
  fetchTodayChores,
  fetchWeekChores,
  getTodayChoresQueryKey,
  getWeekChoresQueryKey,
} from "@/app/household/board/chores-query";
import type { ChoreItem } from "@/app/household/board/types";
import type {
  LoadChoresFn,
  UseHouseholdChoresDataModel,
  UseHouseholdChoresDataParams,
} from "@/app/household/board/useHouseholdChoresData.types";
import { HouseholdContextRedirectError } from "@/app/household/household-context-client";

export type {
  LoadChoresFn,
  UseHouseholdChoresDataModel,
  UseHouseholdChoresDataParams,
} from "@/app/household/board/useHouseholdChoresData.types";

const toNextChores = ({
  previous,
  value,
}: {
  previous: ChoresQueryData | undefined;
  value: SetStateAction<ChoreItem[]>;
}): ChoresQueryData => {
  const previousChores = previous?.chores ?? [];
  const nextChores =
    typeof value === "function"
      ? (value as (current: ChoreItem[]) => ChoreItem[])(previousChores)
      : value;

  return {
    chores: nextChores,
    timeZone: previous?.timeZone ?? null,
    rangeStart: previous?.rangeStart ?? null,
    rangeEnd: previous?.rangeEnd ?? null,
  };
};

export default function useHouseholdChoresData({
  weekStartKey,
  weekEndKey,
  refreshVersion,
  todayKey,
  setTimeZone,
}: UseHouseholdChoresDataParams): UseHouseholdChoresDataModel {
  const queryClient = useQueryClient();
  const weekChoresQueryKey = useMemo(
    () => getWeekChoresQueryKey(weekStartKey, weekEndKey),
    [weekStartKey, weekEndKey],
  );
  const todayChoresQueryKey = useMemo(() => getTodayChoresQueryKey(todayKey), [todayKey]);

  const weekChoresQuery = useQuery({
    queryKey: weekChoresQueryKey,
    queryFn: ({ signal }) =>
      fetchWeekChores({ rangeStart: weekStartKey, rangeEnd: weekEndKey, signal }),
    retry: false,
  });

  const todayChoresQuery = useQuery({
    queryKey: todayChoresQueryKey,
    queryFn: ({ signal }) => fetchTodayChores({ todayKey, signal }),
    retry: false,
    enabled: Boolean(todayKey),
  });

  useEffect(() => {
    if (refreshVersion === 0) return;
    // Resumption can change server state even when the local calendar day did not change.
    // Mark cached ranges stale too, so returning to a pinned week cannot reuse pre-midnight data.
    void queryClient.invalidateQueries({ queryKey: ["household-chores"] });
  }, [queryClient, refreshVersion]);

  const setChores = useCallback<Dispatch<SetStateAction<ChoreItem[]>>>(
    (value) => {
      queryClient.setQueryData<ChoresQueryData>(weekChoresQueryKey, (previous) =>
        toNextChores({
          previous,
          value,
        }),
      );
    },
    [queryClient, weekChoresQueryKey],
  );

  const loadChores = useCallback<LoadChoresFn>(
    async ({ force }: { force?: boolean } = {}) => {
      if (force) {
        await queryClient.invalidateQueries({
          queryKey: weekChoresQueryKey,
          exact: true,
        });
        return;
      }

      await queryClient.refetchQueries({
        queryKey: weekChoresQueryKey,
        exact: true,
        type: "active",
      });
    },
    [queryClient, weekChoresQueryKey],
  );

  useEffect(() => {
    const data = weekChoresQuery.data;
    if (!data) {
      return;
    }

    const nextTimeZone = data.timeZone;
    if (nextTimeZone) {
      setTimeZone((current) => (nextTimeZone !== current ? nextTimeZone : current));
    }
  }, [setTimeZone, weekChoresQuery.data]);

  const loadTodayChores = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: todayChoresQueryKey,
      exact: true,
      type: "active",
    });
  }, [queryClient, todayChoresQueryKey]);

  useEffect(() => {
    const data = todayChoresQuery.data;
    const nextTimeZone = data?.timeZone;
    if (!nextTimeZone) {
      return;
    }

    setTimeZone((current) => (nextTimeZone !== current ? nextTimeZone : current));
  }, [setTimeZone, todayChoresQuery.data]);

  useEffect(() => {
    const error = weekChoresQuery.error;
    if (!error) {
      return;
    }

    if (error instanceof HouseholdContextRedirectError) {
      window.location.assign(error.redirectPath);
      return;
    }

    console.error(error);
  }, [weekChoresQuery.error]);

  useEffect(() => {
    const error = todayChoresQuery.error;
    if (!error) {
      return;
    }

    if (error instanceof HouseholdContextRedirectError) {
      window.location.assign(error.redirectPath);
      return;
    }

    console.error(error);
  }, [todayChoresQuery.error]);

  const chores = weekChoresQuery.data?.chores ?? [];
  const todayChores = todayChoresQuery.data?.chores ?? [];
  const loading = weekChoresQuery.isPending;
  const loadingToday = todayChoresQuery.isPending;

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
