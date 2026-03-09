import type { ChoreType } from "@/lib/chore-ui-state";

export type ChoreItem = {
  id: number;
  title: string;
  type: ChoreType;
  is_repeating?: boolean;
  series_start_date?: string;
  repeat_rule?: string;
  series_end_date?: string | null;
  duration_days?: number;
  occurrence_date: string;
  occurrence_start_date: string;
  status: string;
  closed_reason?: string | null;
  notes?: string | null;
};
