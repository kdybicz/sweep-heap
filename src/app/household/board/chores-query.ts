import type { ChoreItem } from "@/app/household/board/types";
import type { FetchChoresFn } from "@/app/household/board/useHouseholdChoresData.types";
import {
  getHouseholdContextRedirectError,
  readApiJsonResponse,
} from "@/app/household/household-context-client";

type ChoresApiResponse = {
  ok?: boolean;
  chores?: ChoreItem[];
  timeZone?: string;
  rangeStart?: string;
  rangeEnd?: string;
  error?: string;
  code?: string;
};

export type ChoresQueryData = {
  chores: ChoreItem[];
  timeZone: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
};

const toChoresQueryData = (data: ChoresApiResponse): ChoresQueryData => ({
  chores: data.chores ?? [],
  timeZone: typeof data.timeZone === "string" ? data.timeZone : null,
  rangeStart: typeof data.rangeStart === "string" ? data.rangeStart : null,
  rangeEnd: typeof data.rangeEnd === "string" ? data.rangeEnd : null,
});

const parseChoresApiResponse = ({
  data,
  fallbackError,
}: {
  data: ChoresApiResponse;
  fallbackError: string;
}) => {
  const redirectError = getHouseholdContextRedirectError(data);
  if (redirectError) {
    throw redirectError;
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? fallbackError);
  }

  return toChoresQueryData(data);
};

export const getWeekChoresQueryKey = (weekOffset: number) =>
  ["household-chores", "week", weekOffset] as const;

export const getTodayChoresQueryKey = (todayKey: string) =>
  ["household-chores", "today", todayKey] as const;

export const fetchWeekChores = async ({
  weekOffset,
  signal,
  fetchImpl = fetch as FetchChoresFn,
}: {
  weekOffset: number;
  signal?: AbortSignal;
  fetchImpl?: FetchChoresFn;
}) => {
  const response = await fetchImpl(`/api/chores?weekOffset=${weekOffset}`, {
    cache: "no-store",
    signal,
  });
  const data = (await readApiJsonResponse<ChoresApiResponse>(response)) ?? {};
  return parseChoresApiResponse({
    data,
    fallbackError: "Failed to load chores",
  });
};

export const fetchTodayChores = async ({
  todayKey,
  signal,
  fetchImpl = fetch as FetchChoresFn,
}: {
  todayKey: string;
  signal?: AbortSignal;
  fetchImpl?: FetchChoresFn;
}) => {
  const response = await fetchImpl(`/api/chores?start=${todayKey}&end=${todayKey}`, {
    cache: "no-store",
    signal,
  });
  const data = (await readApiJsonResponse<ChoresApiResponse>(response)) ?? {};
  return parseChoresApiResponse({
    data,
    fallbackError: "Failed to load today's chores",
  });
};
