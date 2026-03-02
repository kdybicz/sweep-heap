import type { Dispatch, SetStateAction } from "react";

import type { ChoreItem } from "@/app/household/board/types";

export type UseHouseholdChoresDataParams = {
  weekOffset: number;
  todayKey: string;
  setTimeZone: Dispatch<SetStateAction<string>>;
  setRangeStart: Dispatch<SetStateAction<string | null>>;
  setRangeEnd: Dispatch<SetStateAction<string | null>>;
};

export type LoadChoresFn = (options?: { force?: boolean }) => Promise<void>;

export type RefValue<T> = {
  current: T;
};

export type FetchChoresFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "json">>;

export type LoadWeekChoresRequestParams = {
  weekOffset: number;
  force?: boolean;
  fetchImpl?: FetchChoresFn;
  lastLoadedOffsetRef: RefValue<string | null>;
  requestIdRef: RefValue<number>;
  activeControllerRef: RefValue<AbortController | null>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  setTimeZone: Dispatch<SetStateAction<string>>;
  setRangeStart: Dispatch<SetStateAction<string | null>>;
  setRangeEnd: Dispatch<SetStateAction<string | null>>;
  onHouseholdRequired: () => void;
  onError: (error: unknown) => void;
};

export type UseHouseholdChoresDataModel = {
  chores: ChoreItem[];
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  loading: boolean;
  todayChores: ChoreItem[];
  loadingToday: boolean;
  loadChores: LoadChoresFn;
  loadTodayChores: () => Promise<void>;
};
