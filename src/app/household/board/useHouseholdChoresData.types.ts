import type { Dispatch, SetStateAction } from "react";

import type { ChoreItem } from "@/app/household/board/types";

export type UseHouseholdChoresDataParams = {
  weekStartKey: string;
  weekEndKey: string;
  refreshVersion: number;
  todayKey: string;
  setTimeZone: Dispatch<SetStateAction<string>>;
};

export type LoadChoresFn = (options?: { force?: boolean }) => Promise<void>;

export type FetchChoresFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "headers" | "json" | "status">>;

export type UseHouseholdChoresDataModel = {
  chores: ChoreItem[];
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  weekLoadState: ChoresLoadState;
  todayChores: ChoreItem[];
  todayLoadState: ChoresLoadState;
  loadChores: LoadChoresFn;
  loadTodayChores: () => Promise<void>;
};

export type ChoresLoadState = {
  loading: boolean;
  fetching: boolean;
  hasData: boolean;
  hasError: boolean;
};
