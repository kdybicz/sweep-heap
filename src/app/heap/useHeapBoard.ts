import { useMemo } from "react";
import type { UseHeapBoardModel } from "@/app/heap/useHeapBoard.types";
import useHeapChoreActions from "@/app/heap/useHeapChoreActions";
import useHeapChoresData from "@/app/heap/useHeapChoresData";
import useHeapWeek from "@/app/heap/useHeapWeek";
import { isChoreCompleted } from "@/lib/chore-ui-state";

export type { UseHeapBoardModel } from "@/app/heap/useHeapBoard.types";

export default function useHeapBoard(): UseHeapBoardModel {
  const week = useHeapWeek();
  const choresData = useHeapChoresData({
    weekOffset: week.weekOffset,
    todayKey: week.todayKey,
    setTimeZone: week.setTimeZone,
    setRangeStart: week.setRangeStart,
    setRangeEnd: week.setRangeEnd,
  });
  const actions = useHeapChoreActions({
    chores: choresData.chores,
    setChores: choresData.setChores,
    loadChores: choresData.loadChores,
    loadTodayChores: choresData.loadTodayChores,
    timeZone: week.timeZone,
  });

  const doneChores = useMemo(
    () => choresData.chores.filter((chore) => isChoreCompleted(chore)).length,
    [choresData.chores],
  );
  const totalChores = choresData.chores.length;
  const openChores = totalChores - doneChores;
  const progress = totalChores ? Math.round((doneChores / totalChores) * 100) : 0;

  return {
    sidebar: {
      doneChores,
      totalChores,
      openChores,
      progress,
      today: week.today,
      loadingToday: choresData.loadingToday,
      todayChores: choresData.todayChores,
      onResetWeek: week.onResetWeek,
      onOpenAddChoreModal: actions.onOpenAddChoreModal,
    },
    week: {
      rangeLabel: week.rangeLabel,
      onPreviousWeek: week.onPreviousWeek,
      onNextWeek: week.onNextWeek,
      days: week.days,
      chores: choresData.chores,
      loading: choresData.loading,
      onSelectChore: actions.onSelectChore,
      onAddChoreForDate: actions.onAddChoreForDate,
    },
    undo: {
      nowMs: actions.nowMs,
      undoToasts: actions.undoToasts,
      onUndo: actions.undoChoreDone,
    },
    addChoreModal: {
      open: actions.showAddModal,
      submitError: actions.submitError,
      fieldErrors: actions.fieldErrors,
      submitting: actions.submitting,
      title: actions.newTitle,
      type: actions.newType,
      date: actions.newDate,
      endDate: actions.newEndDate,
      repeat: actions.newRepeat,
      repeatEnd: actions.newRepeatEnd,
      notes: actions.newNotes,
      onClose: actions.closeAddChoreModal,
      onCancel: actions.resetAddChore,
      onSubmit: actions.submitAddChore,
      onTitleChange: actions.setNewTitle,
      onTypeChange: actions.setNewType,
      onDateChange: actions.setNewDate,
      onEndDateChange: actions.setNewEndDate,
      onRepeatChange: actions.setNewRepeat,
      onRepeatEndChange: actions.setNewRepeatEnd,
      onNotesChange: actions.setNewNotes,
    },
    choreDetailsModal: {
      chore: actions.selectedChore,
      todayKey: week.todayKey,
      onClose: actions.closeSelectedChore,
      onPrimaryAction: actions.primarySelectedChoreAction,
    },
  };
}
