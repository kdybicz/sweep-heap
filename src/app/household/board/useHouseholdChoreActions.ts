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
  getSeriesEndDateForSubmit,
  isChoreEditDirty,
} from "@/app/household/board/chore-form";
import { getChorePreviewDateMutationTarget } from "@/app/household/board/chore-preview";
import { addDaysToDateKey, getHouseholdTodayKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";
import type {
  CancelChoreScope,
  DeleteChoreParams,
  EditChoreScope,
  RepeatEndMode,
  SaveChoreDateChangesParams,
  SaveChoreDetailsChangesParams,
  SaveChoreNotesChangesParams,
  SaveChoreRepeatChangesParams,
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
  data?: {
    choreId?: number;
    createdChoreId?: number;
    occurrenceStartDate?: string;
    scope?: string;
  };
  status?: string;
  closed_reason?: string;
};

type SaveChoreEditPayload = {
  choreId: number;
  occurrenceStartDate: string;
  scope: EditChoreScope;
  title?: string;
  type?: ChoreType;
  startDate?: string;
  endDate?: string;
  repeatRule?: string;
  seriesEndDate?: string | null;
  notes?: string;
};

type SaveChoreEditResult =
  | { ok: true; data?: ChoreMutationResponse["data"] }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      recovered?: boolean;
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
  const [newEndDate, setNewEndDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeatEnd, setNewRepeatEnd] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeatEndMode, setNewRepeatEndMode] = useState<RepeatEndMode>("never");
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
    if (newEndDate >= newDate) {
      return;
    }
    setNewEndDate(newDate);
  }, [newDate, newEndDate]);

  const populateFormFromChore = useCallback((chore: ChoreItem, scope: EditChoreScope) => {
    const values = getChoreFormValuesFromChore(chore, scope);
    setNewTitle(values.title);
    setNewType(values.type);
    setNewDate(values.date);
    setNewEndDate(values.endDate);
    setNewRepeat(values.repeat);
    setNewRepeatEndMode(values.repeatEndMode);
    setNewRepeatEnd(values.repeatEnd);
    setNewNotes(values.notes);
  }, []);

  const modalCopy = getChoreFormModalCopy(formMode);
  const addModalTitle = modalCopy.title;
  const addModalDescription = modalCopy.description;
  const addModalSubmitLabel = modalCopy.submitLabel;
  const addModalSubmitDisabled =
    editingChore !== null &&
    !isChoreEditDirty({
      original: getChoreFormValuesFromChore(
        editingChore,
        formMode === "edit_single" ? "single" : formMode === "edit_following" ? "following" : "all",
      ),
      current: {
        title: newTitle,
        type: newType,
        date: newDate,
        endDate: newEndDate,
        repeat: newRepeat,
        repeatEndMode: newRepeatEndMode,
        repeatEnd: newRepeatEnd,
        notes: newNotes,
      },
    });

  const resetAddChore = useCallback(() => {
    setShowAddModal(false);
    setFormMode("create");
    setEditingChore(null);
    setNewTitle("");
    setNewType("close_on_done");
    const defaultTodayKey = getHouseholdTodayKey(timeZone);
    setNewDate(defaultTodayKey);
    setNewRepeat("none");
    setNewRepeatEndMode("never");
    setNewEndDate(defaultTodayKey);
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
        setNewEndDate(dayKey);
        setNewRepeatEndMode("never");
        setNewRepeatEnd(dayKey);
      }
    },
    [onOpenAddChoreModal],
  );

  const refreshChoreCollections = useCallback(async () => {
    await loadChores({ force: true });
    await loadTodayChores();
  }, [loadChores, loadTodayChores]);

  const saveChoreEdit = useCallback(
    async (payload: SaveChoreEditPayload): Promise<SaveChoreEditResult> => {
      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            ...payload,
          }),
        });
        const data = await readApiJsonResponse<ChoreMutationResponse>(response);

        if (recoverFromHouseholdContextError(data)) {
          return {
            ok: false,
            error: "Household context changed",
            recovered: true,
          };
        }

        if (!data?.ok) {
          return {
            ok: false,
            error: data?.error ?? "Failed to save chore",
            fieldErrors: data?.fieldErrors,
          };
        }

        await refreshChoreCollections();
        return { ok: true, data: data?.data };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to save chore",
        };
      }
    },
    [refreshChoreCollections],
  );

  const saveChoreDateChanges = useCallback(
    async ({ chore, scope, startDate, endDate }: SaveChoreDateChangesParams) => {
      const result = await saveChoreEdit({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope,
        startDate,
        endDate: addDaysToDateKey(endDate, 1),
      });

      if (result.ok) {
        const target = getChorePreviewDateMutationTarget({
          chore,
          scope,
          startDate,
          targetChoreId: result.data?.createdChoreId ?? chore.id,
          targetOccurrenceStartDate: result.data?.occurrenceStartDate,
        });

        return {
          error: null,
          targetChoreId: target?.choreId,
          targetOccurrenceStartDate: target?.occurrenceStartDate,
        };
      }

      if (result.fieldErrors?.startDate) {
        return { error: result.fieldErrors.startDate };
      }

      if (result.fieldErrors?.endDate) {
        return { error: result.fieldErrors.endDate };
      }

      if (result.recovered) {
        return { error: "Unable to save chore right now" };
      }

      return { error: result.error };
    },
    [saveChoreEdit],
  );

  const saveChoreDetailsChanges = useCallback(
    async ({ chore, scope, title, type }: SaveChoreDetailsChangesParams) => {
      const result = await saveChoreEdit({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope,
        title,
        type,
      });

      if (result.ok) {
        return {
          error: null,
          targetChoreId: result.data?.createdChoreId ?? chore.id,
          targetOccurrenceStartDate:
            result.data?.occurrenceStartDate ?? chore.occurrence_start_date,
        };
      }

      if (result.fieldErrors?.title) {
        return { error: result.fieldErrors.title };
      }

      if (result.fieldErrors?.type) {
        return { error: result.fieldErrors.type };
      }

      if (result.recovered) {
        return { error: "Unable to save chore right now" };
      }

      return { error: result.error };
    },
    [saveChoreEdit],
  );

  const saveChoreRepeatChanges = useCallback(
    async ({ chore, scope, repeatRule, seriesEndDate }: SaveChoreRepeatChangesParams) => {
      const result = await saveChoreEdit({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope,
        repeatRule,
        seriesEndDate,
      });

      if (result.ok) {
        return {
          error: null,
          targetChoreId: result.data?.createdChoreId ?? chore.id,
          targetOccurrenceStartDate:
            result.data?.occurrenceStartDate ?? chore.occurrence_start_date,
        };
      }

      if (result.fieldErrors?.repeatRule) {
        return { error: result.fieldErrors.repeatRule };
      }

      if (result.fieldErrors?.repeatEnd) {
        return { error: result.fieldErrors.repeatEnd };
      }

      if (result.recovered) {
        return { error: "Unable to save chore right now" };
      }

      return { error: result.error };
    },
    [saveChoreEdit],
  );

  const saveChoreNotesChanges = useCallback(
    async ({ chore, scope, notes }: SaveChoreNotesChangesParams) => {
      const result = await saveChoreEdit({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope,
        notes,
      });

      if (result.ok) {
        return {
          error: null,
          targetChoreId: result.data?.createdChoreId ?? chore.id,
          targetOccurrenceStartDate:
            result.data?.occurrenceStartDate ?? chore.occurrence_start_date,
        };
      }

      if (result.recovered) {
        return { error: "Unable to save chore right now" };
      }

      return { error: result.error };
    },
    [saveChoreEdit],
  );

  const cancelChore = useCallback(
    async ({ choreId, occurrenceStartDate, scope }: DeleteChoreParams): Promise<string | null> => {
      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel",
            scope,
            choreId,
            occurrenceStartDate,
          }),
        });
        const data = await readApiJsonResponse<ChoreMutationResponse>(response);
        if (recoverFromHouseholdContextError(data)) {
          return "Unable to delete chore right now";
        }
        if (!data?.ok) {
          return data?.error ?? "Failed to delete chore";
        }

        await refreshChoreCollections();
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Failed to delete chore";
      }
    },
    [refreshChoreCollections],
  );

  const submitAddChore = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (addModalSubmitDisabled) {
        return;
      }
      setSubmitError(null);
      setFieldErrors({});
      setSubmitting(true);
      const scope =
        formMode === "edit_single" ? "single" : formMode === "edit_following" ? "following" : "all";

      try {
        if (editingChore) {
          const result = await saveChoreEdit({
            choreId: editingChore.id,
            occurrenceStartDate: editingChore.occurrence_start_date,
            scope,
            title: newTitle,
            type: newType,
            startDate: newDate,
            endDate: addDaysToDateKey(newEndDate, 1),
            repeatRule: newRepeat,
            seriesEndDate: getSeriesEndDateForSubmit({
              repeat: newRepeat,
              repeatEndMode: newRepeatEndMode,
              repeatEnd: newRepeatEnd,
            }),
            notes: newNotes,
          });

          if (!result.ok) {
            if (result.recovered) {
              setSubmitting(false);
              return;
            }

            setFieldErrors(result.fieldErrors ?? {});
            setSubmitError(result.error);
            setSubmitting(false);
            return;
          }

          resetAddChore();
          setSelectedChoreError(null);
          setSelectedChoreSubmitting(false);
          setSelectedChore(null);
          setSubmitting(false);
          return;
        }

        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: newTitle,
            type: newType,
            startDate: newDate,
            endDate: addDaysToDateKey(newEndDate, 1),
            repeatRule: newRepeat,
            seriesEndDate: getSeriesEndDateForSubmit({
              repeat: newRepeat,
              repeatEndMode: newRepeatEndMode,
              repeatEnd: newRepeatEnd,
            }),
            notes: newNotes,
          }),
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
        await refreshChoreCollections();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save chore";
        setSubmitError(message);
      }
      setSubmitting(false);
    },
    [
      newDate,
      newEndDate,
      editingChore,
      formMode,
      newNotes,
      newRepeat,
      newRepeatEndMode,
      newRepeatEnd,
      newTitle,
      newType,
      resetAddChore,
      addModalSubmitDisabled,
      refreshChoreCollections,
      saveChoreEdit,
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

      const error = await cancelChore({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope,
      });
      if (!error) {
        closeSelectedChore();
        return;
      }

      setSelectedChoreError(error);
      setSelectedChoreSubmitting(false);
    },
    [cancelChore, closeSelectedChore],
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
    addModalSubmitDisabled,
    submitError,
    fieldErrors,
    submitting,
    newTitle,
    newType,
    newDate,
    newEndDate,
    newRepeat,
    newRepeatEndMode,
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
    setNewRepeatEndMode,
    setNewRepeatEnd,
    setNewNotes,
    selectedChore,
    selectedChoreError,
    selectedChoreSubmitting,
    closeSelectedChore,
    primarySelectedChoreAction,
    cancelSelectedChore,
    editSelectedChore,
    saveChoreDateChanges,
    saveChoreDetailsChanges,
    deleteChore: cancelChore,
    saveChoreNotesChanges,
    saveChoreRepeatChanges,
    onSelectChore: selectChore,
    onAddChoreForDate,
    onOpenAddChoreModal,
  };
}
