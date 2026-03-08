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

export type FetchChoresFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "headers" | "json" | "status">>;

export type UseHouseholdChoresDataModel = {
  chores: ChoreItem[];
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  loading: boolean;
  todayChores: ChoreItem[];
  loadingToday: boolean;
  loadChores: LoadChoresFn;
  loadTodayChores: () => Promise<void>;
};
