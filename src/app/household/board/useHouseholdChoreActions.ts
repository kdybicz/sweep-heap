import { DateTime } from "luxon";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getHouseholdTodayKey } from "@/app/household/board/date-utils";
import type { ChoreItem, UndoToast } from "@/app/household/board/types";
import type {
  UseHouseholdChoreActionsModel,
  UseHouseholdChoreActionsParams,
} from "@/app/household/board/useHouseholdChoreActions.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type {
  UseHouseholdChoreActionsModel,
  UseHouseholdChoreActionsParams,
} from "@/app/household/board/useHouseholdChoreActions.types";

export default function useHouseholdChoreActions({
  chores,
  setChores,
  loadChores,
  loadTodayChores,
  timeZone,
}: UseHouseholdChoreActionsParams): UseHouseholdChoreActionsModel {
  const toastTickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowMs, setNowMs] = useState(() => DateTime.utc().toMillis());
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ChoreType>("close_on_done");
  const [newDate, setNewDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeat, setNewRepeat] = useState("none");
  const [newEndDate, setNewEndDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeatEnd, setNewRepeatEnd] = useState(() => getHouseholdTodayKey(timeZone));
  const [newNotes, setNewNotes] = useState("");
  const [selectedChore, setSelectedChore] = useState<ChoreItem | null>(null);

  const clearToastTick = useCallback(() => {
    if (toastTickRef.current) {
      clearTimeout(toastTickRef.current);
      toastTickRef.current = null;
    }
  }, []);

  useEffect(() => {
    const scheduleNextUndoExpiryTick = () => {
      const currentNowMs = DateTime.utc().toMillis();
      setNowMs(currentNowMs);

      let nextUndoExpiryMs: number | null = null;

      for (const chore of chores) {
        if (!chore.can_undo || !chore.undo_until) {
          continue;
        }

        const undoExpiryMs = DateTime.fromISO(chore.undo_until).toMillis();
        if (undoExpiryMs <= currentNowMs) {
          continue;
        }

        if (nextUndoExpiryMs === null || undoExpiryMs < nextUndoExpiryMs) {
          nextUndoExpiryMs = undoExpiryMs;
        }
      }

      if (nextUndoExpiryMs === null) {
        clearToastTick();
        return;
      }

      clearToastTick();
      toastTickRef.current = setTimeout(
        scheduleNextUndoExpiryTick,
        Math.max(0, nextUndoExpiryMs - currentNowMs + 16),
      );
    };

    scheduleNextUndoExpiryTick();

    return () => {
      clearToastTick();
    };
  }, [chores, clearToastTick]);

  useEffect(() => {
    if (!newRepeatEnd) {
      setNewRepeatEnd(newDate);
    }
  }, [newDate, newRepeatEnd]);

  const undoToasts = useMemo<UndoToast[]>(() => {
    return chores
      .filter((chore) => chore.can_undo && chore.undo_until)
      .map((chore) => ({
        choreId: chore.id,
        occurrenceDate: chore.occurrence_date,
        title: chore.title,
        type: chore.type,
        undoUntil: chore.undo_until as string,
      }))
      .filter((toast) => DateTime.fromISO(toast.undoUntil).toMillis() > nowMs)
      .sort(
        (a, b) =>
          DateTime.fromISO(b.undoUntil).toMillis() - DateTime.fromISO(a.undoUntil).toMillis(),
      );
  }, [chores, nowMs]);

  const resetAddChore = useCallback(() => {
    setShowAddModal(false);
    setNewTitle("");
    setNewType("close_on_done");
    const defaultTodayKey = getHouseholdTodayKey(timeZone);
    setNewDate(defaultTodayKey);
    setNewRepeat("none");
    setNewEndDate(defaultTodayKey);
    setNewRepeatEnd(defaultTodayKey);
    setNewNotes("");
    setSubmitError(null);
    setFieldErrors({});
  }, [timeZone]);

  const onOpenAddChoreModal = useCallback(() => {
    setSubmitError(null);
    setNewType("close_on_done");
    setShowAddModal(true);
  }, []);

  const onAddChoreForDate = useCallback(
    (dayKey: string | null) => {
      onOpenAddChoreModal();
      if (dayKey) {
        setNewDate(dayKey);
        setNewEndDate(dayKey);
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
        action: "create",
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
        const data = await response.json();
        if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
        if (!data?.ok) {
          if (data?.fieldErrors) {
            setFieldErrors(data.fieldErrors);
            setSubmitError(data.error ?? "Validation failed");
            setSubmitting(false);
            return;
          }
          throw new Error(data?.error ?? "Failed to create chore");
        }
        resetAddChore();
        await loadChores({ force: true });
        await loadTodayChores();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create chore";
        setSubmitError(message);
      }
      setSubmitting(false);
    },
    [
      loadChores,
      loadTodayChores,
      newDate,
      newEndDate,
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
      const occurrenceDate = targetChore.occurrence_date;
      const optimisticStatus = targetChore.type === "stay_open" ? "open" : "closed";
      const undoUntil = DateTime.utc().plus({ seconds: 5 }).toISO();
      const previous = chores.find(
        (chore) => chore.id === choreId && chore.occurrence_date === occurrenceDate,
      );
      setChores((prev) =>
        prev.map((chore) =>
          chore.id === choreId && chore.occurrence_date === occurrenceDate
            ? {
                ...chore,
                status: optimisticStatus,
                closed_reason: "done",
                undo_until: undoUntil,
                can_undo: true,
              }
            : chore,
        ),
      );

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choreId,
            occurrenceDate,
            status: "closed",
            action: "set",
          }),
        });
        const data = await response.json();
        if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
        if (!data?.ok) {
          throw new Error(data?.error ?? "Failed to update chore");
        }
        if (data.undo_until) {
          setChores((prev) =>
            prev.map((chore) =>
              chore.id === choreId && chore.occurrence_date === occurrenceDate
                ? {
                    ...chore,
                    status: typeof data.status === "string" ? data.status : optimisticStatus,
                    closed_reason:
                      typeof data.closed_reason === "string" ? data.closed_reason : "done",
                    undo_until: data.undo_until,
                    can_undo: true,
                  }
                : chore,
            ),
          );
        }
      } catch (error) {
        console.error(error);
        if (previous) {
          setChores((prev) =>
            prev.map((chore) =>
              chore.id === choreId && chore.occurrence_date === occurrenceDate ? previous : chore,
            ),
          );
        }
      } finally {
        await loadTodayChores();
      }
    },
    [chores, loadTodayChores, setChores],
  );

  const undoChoreDone = useCallback(
    async (choreId: number, occurrenceDate: string) => {
      const previous = chores.find(
        (chore) => chore.id === choreId && chore.occurrence_date === occurrenceDate,
      );
      setChores((prev) =>
        prev.map((chore) =>
          chore.id === choreId && chore.occurrence_date === occurrenceDate
            ? {
                ...chore,
                status: "open",
                closed_reason: null,
                undo_until: null,
                can_undo: false,
              }
            : chore,
        ),
      );

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choreId,
            occurrenceDate,
            action: "undo",
          }),
        });
        const data = await response.json();
        if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
        if (!data?.ok) {
          throw new Error(data?.error ?? "Failed to undo chore");
        }
      } catch (error) {
        console.error(error);
        if (previous) {
          setChores((prev) =>
            prev.map((chore) =>
              chore.id === choreId && chore.occurrence_date === occurrenceDate ? previous : chore,
            ),
          );
        }
      } finally {
        await loadTodayChores();
      }
    },
    [chores, loadTodayChores, setChores],
  );

  const closeSelectedChore = useCallback(() => {
    setSelectedChore(null);
  }, []);

  const primarySelectedChoreAction = useCallback(
    (chore: ChoreItem) => {
      void markChoreDone(chore);
      setSelectedChore(null);
    },
    [markChoreDone],
  );

  const closeAddChoreModal = useCallback(() => {
    setShowAddModal(false);
  }, []);

  return {
    nowMs,
    undoToasts,
    undoChoreDone,
    showAddModal,
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
    closeSelectedChore,
    primarySelectedChoreAction,
    onSelectChore: setSelectedChore,
    onAddChoreForDate,
    onOpenAddChoreModal,
  };
}
