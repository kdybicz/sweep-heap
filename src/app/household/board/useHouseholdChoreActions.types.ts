import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { ChoreItem } from "@/app/household/board/types";
import type { LoadChoresFn } from "@/app/household/board/useHouseholdChoresData.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type CancelChoreScope = "single" | "following" | "all";
export type EditChoreScope = "single" | "following" | "all";

export type UseHouseholdChoreActionsParams = {
  chores: ChoreItem[];
  setChores: Dispatch<SetStateAction<ChoreItem[]>>;
  loadChores: LoadChoresFn;
  loadTodayChores: () => Promise<void>;
  timeZone: string;
};

export type UseHouseholdChoreActionsModel = {
  showAddModal: boolean;
  addModalTitle: string;
  addModalDescription: string;
  addModalSubmitLabel: string;
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
  selectedChoreError: string | null;
  selectedChoreSubmitting: boolean;
  closeSelectedChore: () => void;
  primarySelectedChoreAction: (chore: ChoreItem) => void;
  cancelSelectedChore: (chore: ChoreItem, scope: CancelChoreScope) => Promise<void>;
  editSelectedChore: (chore: ChoreItem, scope: EditChoreScope) => void;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
  onOpenAddChoreModal: () => void;
};
