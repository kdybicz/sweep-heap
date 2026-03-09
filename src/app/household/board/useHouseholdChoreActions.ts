import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  applyOptimisticDone,
  findTargetChores,
  restoreTargetChores,
} from "@/app/household/board/chore-actions-state";
import type { ChoreFormMode } from "@/app/household/board/chore-form";
import {
  getChoreFormModalCopy,
  getChoreFormModeFromScope,
  getChoreFormValuesFromChore,
} from "@/app/household/board/chore-form";
import { addDaysToDateKey, getHouseholdTodayKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";
import type {
  CancelChoreScope,
  EditChoreScope,
  UseHouseholdChoreActionsModel,
  UseHouseholdChoreActionsParams,
} from "@/app/household/board/useHouseholdChoreActions.types";
import {
  readApiJsonResponse,
  recoverFromHouseholdContextError,
} from "@/app/household/household-context-client";
import type { ChoreType } from "@/lib/chore-ui-state";

export type {
  UseHouseholdChoreActionsModel,
  UseHouseholdChoreActionsParams,
} from "@/app/household/board/useHouseholdChoreActions.types";

type ChoreMutationResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: string;
  closed_reason?: string;
};

export default function useHouseholdChoreActions({
  chores,
  setChores,
  loadChores,
  loadTodayChores,
  timeZone,
}: UseHouseholdChoreActionsParams): UseHouseholdChoreActionsModel {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState<ChoreFormMode>("create");
  const [editingChore, setEditingChore] = useState<ChoreItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ChoreType>("close_on_done");
  const [newDate, setNewDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeat, setNewRepeat] = useState("none");
  const [newEndDate, setNewEndDate] = useState(() =>
    addDaysToDateKey(getHouseholdTodayKey(timeZone), 1),
  );
  const [newRepeatEnd, setNewRepeatEnd] = useState(() => getHouseholdTodayKey(timeZone));
  const [newNotes, setNewNotes] = useState("");
  const [selectedChore, setSelectedChore] = useState<ChoreItem | null>(null);
  const [selectedChoreError, setSelectedChoreError] = useState<string | null>(null);
  const [selectedChoreSubmitting, setSelectedChoreSubmitting] = useState(false);

  useEffect(() => {
    if (!newRepeatEnd) {
      setNewRepeatEnd(newDate);
    }
  }, [newDate, newRepeatEnd]);

  useEffect(() => {
    if (newEndDate > newDate) {
      return;
    }
    setNewEndDate(addDaysToDateKey(newDate, 1));
  }, [newDate, newEndDate]);

  const populateFormFromChore = useCallback((chore: ChoreItem, scope: EditChoreScope) => {
    const values = getChoreFormValuesFromChore(chore, scope);
    setNewTitle(values.title);
    setNewType(values.type);
    setNewDate(values.date);
    setNewEndDate(values.endDate);
    setNewRepeat(values.repeat);
    setNewRepeatEnd(values.repeatEnd);
    setNewNotes(values.notes);
  }, []);

  const modalCopy = getChoreFormModalCopy(formMode);
  const addModalTitle = modalCopy.title;
  const addModalDescription = modalCopy.description;
  const addModalSubmitLabel = modalCopy.submitLabel;

  const resetAddChore = useCallback(() => {
    setShowAddModal(false);
    setFormMode("create");
    setEditingChore(null);
    setNewTitle("");
    setNewType("close_on_done");
    const defaultTodayKey = getHouseholdTodayKey(timeZone);
    setNewDate(defaultTodayKey);
    setNewRepeat("none");
    setNewEndDate(addDaysToDateKey(defaultTodayKey, 1));
    setNewRepeatEnd(defaultTodayKey);
    setNewNotes("");
    setSubmitError(null);
    setFieldErrors({});
  }, [timeZone]);

  const onOpenAddChoreModal = useCallback(() => {
    setSubmitError(null);
    setEditingChore(null);
    setFormMode("create");
    setNewType("close_on_done");
    setShowAddModal(true);
  }, []);

  const onAddChoreForDate = useCallback(
    (dayKey: string | null) => {
      onOpenAddChoreModal();
      if (dayKey) {
        setNewDate(dayKey);
        setNewEndDate(addDaysToDateKey(dayKey, 1));
        setNewRepeatEnd(dayKey);
      }
    },
    [onOpenAddChoreModal],
  );

  const submitAddChore = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      setFieldErrors({});
      setSubmitting(true);
      const payload = {
        action: editingChore ? formMode : "create",
        choreId: editingChore?.id,
        occurrenceStartDate: editingChore?.occurrence_start_date,
        title: newTitle,
        type: newType,
        startDate: newDate,
        endDate: newEndDate,
        repeatRule: newRepeat,
        seriesEndDate: newRepeat !== "none" ? newRepeatEnd : null,
        notes: newNotes,
      };

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readApiJsonResponse<ChoreMutationResponse>(response);
        if (recoverFromHouseholdContextError(data)) {
          setSubmitting(false);
          return;
        }
        if (!data?.ok) {
          if (data?.fieldErrors) {
            setFieldErrors(data.fieldErrors);
            setSubmitError(data.error ?? "Validation failed");
            setSubmitting(false);
            return;
          }
          throw new Error(data?.error ?? "Failed to save chore");
        }
        resetAddChore();
        setSelectedChoreError(null);
        setSelectedChoreSubmitting(false);
        setSelectedChore(null);
        await loadChores({ force: true });
        await loadTodayChores();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save chore";
        setSubmitError(message);
      }
      setSubmitting(false);
    },
    [
      loadChores,
      loadTodayChores,
      newDate,
      newEndDate,
      editingChore,
      formMode,
      newNotes,
      newRepeat,
      newRepeatEnd,
      newTitle,
      newType,
      resetAddChore,
    ],
  );

  const markChoreDone = useCallback(
    async (targetChore: ChoreItem) => {
      const choreId = targetChore.id;
      const occurrenceStartDate = targetChore.occurrence_start_date;
      const optimisticStatus = targetChore.type === "stay_open" ? "open" : "closed";
      const previous = findTargetChores({ chores, choreId, occurrenceStartDate });
      setChores((prev) =>
        applyOptimisticDone({
          chores: prev,
          choreId,
          occurrenceStartDate,
          optimisticStatus,
        }),
      );

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choreId,
            occurrenceStartDate,
            status: "closed",
            action: "set",
          }),
        });
        const data = await readApiJsonResponse<ChoreMutationResponse>(response);
        if (recoverFromHouseholdContextError(data)) {
          if (previous.length > 0) {
            setChores((prev) =>
              restoreTargetChores({ chores: prev, choreId, occurrenceStartDate, previous }),
            );
          }
          return;
        }
        if (!data?.ok) {
          throw new Error(data?.error ?? "Failed to update chore");
        }
      } catch (error) {
        console.error(error);
        if (previous.length > 0) {
          setChores((prev) =>
            restoreTargetChores({ chores: prev, choreId, occurrenceStartDate, previous }),
          );
        }
      } finally {
        await loadTodayChores();
      }
    },
    [chores, loadTodayChores, setChores],
  );

  const closeSelectedChore = useCallback(() => {
    setSelectedChoreError(null);
    setSelectedChoreSubmitting(false);
    setSelectedChore(null);
  }, []);

  const cancelSelectedChore = useCallback(
    async (chore: ChoreItem, scope: CancelChoreScope) => {
      setSelectedChoreError(null);
      setSelectedChoreSubmitting(true);

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel",
            cancelScope: scope,
            choreId: chore.id,
            occurrenceStartDate: chore.occurrence_start_date,
          }),
        });
        const data = await readApiJsonResponse<ChoreMutationResponse>(response);
        if (recoverFromHouseholdContextError(data)) {
          setSelectedChoreSubmitting(false);
          return;
        }
        if (!data?.ok) {
          throw new Error(data?.error ?? "Failed to cancel chore occurrence");
        }

        closeSelectedChore();
        await loadChores({ force: true });
        await loadTodayChores();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to cancel chore occurrence";
        setSelectedChoreError(message);
        setSelectedChoreSubmitting(false);
      }
    },
    [closeSelectedChore, loadChores, loadTodayChores],
  );

  const editSelectedChore = useCallback(
    (chore: ChoreItem, scope: EditChoreScope) => {
      setSelectedChoreError(null);
      setFieldErrors({});
      setSubmitError(null);
      setEditingChore(chore);
      setFormMode(getChoreFormModeFromScope(scope));
      populateFormFromChore(chore, scope);
      setShowAddModal(true);
      setSelectedChore(null);
    },
    [populateFormFromChore],
  );

  const primarySelectedChoreAction = useCallback(
    (chore: ChoreItem) => {
      setSelectedChoreError(null);
      void markChoreDone(chore);
      setSelectedChore(null);
    },
    [markChoreDone],
  );

  const closeAddChoreModal = useCallback(() => {
    resetAddChore();
  }, [resetAddChore]);

  const selectChore = useCallback((chore: ChoreItem) => {
    setSelectedChoreError(null);
    setSelectedChoreSubmitting(false);
    setSelectedChore(chore);
  }, []);

  return {
    showAddModal,
    addModalTitle,
    addModalDescription,
    addModalSubmitLabel,
    submitError,
    fieldErrors,
    submitting,
    newTitle,
    newType,
    newDate,
    newEndDate,
    newRepeat,
    newRepeatEnd,
    newNotes,
    closeAddChoreModal,
    resetAddChore,
    submitAddChore,
    setNewTitle,
    setNewType,
    setNewDate,
    setNewEndDate,
    setNewRepeat,
    setNewRepeatEnd,
    setNewNotes,
    selectedChore,
    selectedChoreError,
    selectedChoreSubmitting,
    closeSelectedChore,
    primarySelectedChoreAction,
    cancelSelectedChore,
    editSelectedChore,
    onSelectChore: selectChore,
    onAddChoreForDate,
    onOpenAddChoreModal,
  };
}
