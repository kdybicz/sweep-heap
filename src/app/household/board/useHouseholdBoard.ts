import { useMemo } from "react";
import type { UseHouseholdBoardModel } from "@/app/household/board/useHouseholdBoard.types";
import useHouseholdChoreActions from "@/app/household/board/useHouseholdChoreActions";
import useHouseholdChoresData from "@/app/household/board/useHouseholdChoresData";
import useHouseholdWeek from "@/app/household/board/useHouseholdWeek";
import { isChoreCompleted } from "@/lib/chore-ui-state";

export type { UseHouseholdBoardModel } from "@/app/household/board/useHouseholdBoard.types";

export default function useHouseholdBoard(): UseHouseholdBoardModel {
  const week = useHouseholdWeek();
  const choresData = useHouseholdChoresData({
    weekOffset: week.weekOffset,
    todayKey: week.todayKey,
    setTimeZone: week.setTimeZone,
    setRangeStart: week.setRangeStart,
    setRangeEnd: week.setRangeEnd,
  });
  const actions = useHouseholdChoreActions({
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
    addChoreModal: {
      open: actions.showAddModal,
      modalTitle: actions.addModalTitle,
      modalDescription: actions.addModalDescription,
      submitLabel: actions.addModalSubmitLabel,
      submitError: actions.submitError,
      fieldErrors: actions.fieldErrors,
      submitting: actions.submitting,
      title: actions.newTitle,
      type: actions.newType,
      date: actions.newDate,
      endDate: actions.newEndDate,
      repeat: actions.newRepeat,
      repeatEndMode: actions.newRepeatEndMode,
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
      onRepeatEndModeChange: actions.setNewRepeatEndMode,
      onRepeatEndChange: actions.setNewRepeatEnd,
      onNotesChange: actions.setNewNotes,
    },
    choreDetailsModal: {
      chore: actions.selectedChore,
      todayKey: week.todayKey,
      error: actions.selectedChoreError,
      submitting: actions.selectedChoreSubmitting,
      onClose: actions.closeSelectedChore,
      onPrimaryAction: actions.primarySelectedChoreAction,
      onCancelAction: actions.cancelSelectedChore,
      onEditAction: actions.editSelectedChore,
    },
  };
}
