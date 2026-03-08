import type { DateTime } from "luxon";
import type { FormEvent } from "react";

import type { ChoreItem, UndoToast } from "@/app/household/board/types";
import type { CancelChoreScope } from "@/app/household/board/useHouseholdChoreActions.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type SidebarModel = {
  doneChores: number;
  totalChores: number;
  openChores: number;
  progress: number;
  today: DateTime;
  loadingToday: boolean;
  todayChores: ChoreItem[];
  onResetWeek: () => void;
};

export type WeekModel = {
  rangeLabel: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  days: DateTime[];
  chores: ChoreItem[];
  loading: boolean;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export type UndoModel = {
  nowMs: number;
  undoToasts: UndoToast[];
  onUndo: (choreId: number, occurrenceStartDate: string) => Promise<void>;
};

export type AddChoreModalModel = {
  open: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  title: string;
  type: ChoreType;
  date: string;
  endDate: string;
  repeat: string;
  repeatEnd: string;
  notes: string;
  onClose: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: ChoreType) => void;
  onDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRepeatChange: (value: string) => void;
  onRepeatEndChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export type ChoreDetailsModalModel = {
  chore: ChoreItem | null;
  todayKey: string;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onPrimaryAction: (chore: ChoreItem) => void;
  onCancelAction: (chore: ChoreItem, scope: CancelChoreScope) => Promise<void>;
};

export type UseHouseholdBoardModel = {
  sidebar: SidebarModel;
  week: WeekModel;
  undo: UndoModel;
  addChoreModal: AddChoreModalModel;
  choreDetailsModal: ChoreDetailsModalModel;
};
