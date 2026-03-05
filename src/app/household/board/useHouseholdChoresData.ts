import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo } from "react";

import {
  type ChoresQueryData,
  fetchTodayChores,
  fetchWeekChores,
  getTodayChoresQueryKey,
  getWeekChoresQueryKey,
  HouseholdRequiredError,
} from "@/app/household/board/chores-query";
import type { ChoreItem } from "@/app/household/board/types";
import type {
  LoadChoresFn,
  UseHouseholdChoresDataModel,
  UseHouseholdChoresDataParams,
} from "@/app/household/board/useHouseholdChoresData.types";

export type {
  LoadChoresFn,
  UseHouseholdChoresDataModel,
  UseHouseholdChoresDataParams,
} from "@/app/household/board/useHouseholdChoresData.types";

const redirectToHouseholdSetup = () => {
  window.location.assign("/household/setup");
};

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
  weekOffset,
  todayKey,
  setTimeZone,
  setRangeStart,
  setRangeEnd,
}: UseHouseholdChoresDataParams): UseHouseholdChoresDataModel {
  const queryClient = useQueryClient();
  const weekChoresQueryKey = useMemo(() => getWeekChoresQueryKey(weekOffset), [weekOffset]);
  const todayChoresQueryKey = useMemo(() => getTodayChoresQueryKey(todayKey), [todayKey]);

  const weekChoresQuery = useQuery({
    queryKey: weekChoresQueryKey,
    queryFn: ({ signal }) => fetchWeekChores({ weekOffset, signal }),
    retry: false,
  });

  const todayChoresQuery = useQuery({
    queryKey: todayChoresQueryKey,
    queryFn: ({ signal }) => fetchTodayChores({ todayKey, signal }),
    retry: false,
    enabled: Boolean(todayKey),
  });

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

    if (data.rangeStart && data.rangeEnd) {
      setRangeStart(data.rangeStart);
      setRangeEnd(data.rangeEnd);
    }
  }, [setRangeEnd, setRangeStart, setTimeZone, weekChoresQuery.data]);

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

    if (error instanceof HouseholdRequiredError) {
      redirectToHouseholdSetup();
      return;
    }

    console.error(error);
  }, [weekChoresQuery.error]);

  useEffect(() => {
    const error = todayChoresQuery.error;
    if (!error) {
      return;
    }

    if (error instanceof HouseholdRequiredError) {
      redirectToHouseholdSetup();
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
