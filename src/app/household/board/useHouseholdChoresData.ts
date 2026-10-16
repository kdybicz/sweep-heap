import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo } from "react";
import {
  type ChoresQueryData,
  choreCompletionMutationKey,
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
  const pendingCompletions = useIsMutating({ mutationKey: choreCompletionMutationKey });
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
    enabled: pendingCompletions === 0,
  });

  const todayChoresQuery = useQuery({
    queryKey: todayChoresQueryKey,
    queryFn: ({ signal }) => fetchTodayChores({ todayKey, signal }),
    retry: false,
    enabled: Boolean(todayKey) && pendingCompletions === 0,
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
    await queryClient.invalidateQueries({
      queryKey: todayChoresQueryKey,
      exact: true,
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
  const loadState = (query: typeof weekChoresQuery) => ({
    loading: query.isPending,
    fetching: query.isFetching,
    hasData: query.data !== undefined,
    hasError: query.isError && !(query.error instanceof HouseholdContextRedirectError),
  });

  return {
    chores,
    setChores,
    weekLoadState: loadState(weekChoresQuery),
    todayChores,
    todayLoadState: loadState(todayChoresQuery),
    loadChores,
    loadTodayChores,
  };
}
