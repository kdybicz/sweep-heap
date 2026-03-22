import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { ChoreItem } from "@/app/household/board/types";
import type { LoadChoresFn } from "@/app/household/board/useHouseholdChoresData.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type CancelChoreScope = "single" | "following" | "all";
export type EditChoreScope = "single" | "following" | "all";
export type RepeatEndMode = "never" | "on_date";

export type SaveChoreDateChangesParams = {
  chore: ChoreItem;
  scope: EditChoreScope;
  startDate: string;
  endDate: string;
};

export type SaveChoreRepeatChangesParams = {
  chore: ChoreItem;
  scope: EditChoreScope;
  repeatRule: string;
  seriesEndDate: string | null;
};

export type SaveChoreNotesChangesParams = {
  chore: ChoreItem;
  scope: EditChoreScope;
  notes: string;
};

export type SaveChoreDetailsChangesParams = {
  chore: ChoreItem;
  scope: EditChoreScope;
  title: string;
  type: ChoreType;
};

export type ChorePreviewMutationTarget = {
  error: string | null;
  targetChoreId?: number;
  targetOccurrenceStartDate?: string;
};

export type DeleteChoreParams = {
  choreId: number;
  occurrenceStartDate: string;
  scope: CancelChoreScope;
};

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
  addModalSubmitDisabled: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  newTitle: string;
  newType: ChoreType;
  newDate: string;
  newEndDate: string;
  newRepeat: string;
  newRepeatEndMode: RepeatEndMode;
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
  setNewRepeatEndMode: (value: RepeatEndMode) => void;
  setNewRepeatEnd: (value: string) => void;
  setNewNotes: (value: string) => void;
  selectedChore: ChoreItem | null;
  selectedChoreError: string | null;
  selectedChoreSubmitting: boolean;
  closeSelectedChore: () => void;
  primarySelectedChoreAction: (chore: ChoreItem) => void;
  cancelSelectedChore: (chore: ChoreItem, scope: CancelChoreScope) => Promise<void>;
  editSelectedChore: (chore: ChoreItem, scope: EditChoreScope) => void;
  saveChoreDateChanges: (params: SaveChoreDateChangesParams) => Promise<ChorePreviewMutationTarget>;
  saveChoreDetailsChanges: (
    params: SaveChoreDetailsChangesParams,
  ) => Promise<ChorePreviewMutationTarget>;
  saveChoreRepeatChanges: (
    params: SaveChoreRepeatChangesParams,
  ) => Promise<ChorePreviewMutationTarget>;
  saveChoreNotesChanges: (
    params: SaveChoreNotesChangesParams,
  ) => Promise<ChorePreviewMutationTarget>;
  deleteChore: (params: DeleteChoreParams) => Promise<string | null>;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
  onOpenAddChoreModal: () => void;
};
