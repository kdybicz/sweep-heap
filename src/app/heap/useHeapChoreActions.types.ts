import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { ChoreItem, UndoToast } from "@/app/heap/types";
import type { LoadChoresFn } from "@/app/heap/useHeapChoresData.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type UseHeapChoreActionsParams = {
  chores: ChoreItem[];
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  loadChores: LoadChoresFn;
  loadTodayChores: () => Promise<void>;
  timeZone: string;
};

export type UseHeapChoreActionsModel = {
  nowMs: number;
  undoToasts: UndoToast[];
  undoChoreDone: (choreId: number, occurrenceDate: string) => Promise<void>;
  showAddModal: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  newTitle: string;
  newType: ChoreType;
  newDate: string;
  newEndDate: string;
  newRepeat: string;
  newRepeatEnd: string;
  newNotes: string;
  closeAddChoreModal: () => void;
  resetAddChore: () => void;
  submitAddChore: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setNewTitle: (value: string) => void;
  setNewType: (value: ChoreType) => void;
  setNewDate: (value: string) => void;
  setNewEndDate: (value: string) => void;
  setNewRepeat: (value: string) => void;
  setNewRepeatEnd: (value: string) => void;
  setNewNotes: (value: string) => void;
  selectedChore: ChoreItem | null;
  closeSelectedChore: () => void;
  primarySelectedChoreAction: (chore: ChoreItem) => void;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
  onOpenAddChoreModal: () => void;
};
