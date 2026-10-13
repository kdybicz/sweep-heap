import type { ApiErrorCode } from "@/lib/api-error";

export type ChoreMutationData = {
  choreId: number;
  createdChoreId?: number;
  occurrenceStartDate?: string;
  action?: string;
  scope?: "single" | "following" | "all";
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  seriesEndDate?: string | null;
  repeatRule?: string;
  type?: "close_on_done" | "stay_open";
  notes?: string | null;
  status?: "open" | "closed";
  closed_reason?: "done" | null;
};

export type ChoreMutationFailure = {
  ok: false;
  code: ApiErrorCode;
  error: string;
  fieldErrors?: Record<string, string>;
};

/** PATCH /api/chores returns mutation fields at the top level, not under data. */
export type ChoreMutationResponse = ({ ok: true } & ChoreMutationData) | ChoreMutationFailure;
