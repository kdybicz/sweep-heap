import type { ChoreType } from "@/lib/chore-ui-state";

export type ChoreItem = {
  id: number;
  title: string;
  type: ChoreType;
  occurrence_date: string;
  status: string;
  closed_reason?: string | null;
  undo_until?: string | null;
  can_undo?: boolean;
  notes?: string | null;
};

export type UndoToast = {
  choreId: number;
  occurrenceDate: string;
  title: string;
  type: ChoreType;
  undoUntil: string;
};
