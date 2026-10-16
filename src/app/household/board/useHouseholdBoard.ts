import { useMemo } from "react";
import { getWeeklyChoreProgress } from "@/app/household/board/chore-progress";
import type { UseHouseholdBoardModel } from "@/app/household/board/useHouseholdBoard.types";
import useHouseholdChoreActions from "@/app/household/board/useHouseholdChoreActions";
import useHouseholdChoresData from "@/app/household/board/useHouseholdChoresData";
import useHouseholdWeek from "@/app/household/board/useHouseholdWeek";

export type { UseHouseholdBoardModel } from "@/app/household/board/useHouseholdBoard.types";

export default function useHouseholdBoard(): UseHouseholdBoardModel {
  const week = useHouseholdWeek();
  const choresData = useHouseholdChoresData({
    weekStartKey: week.weekStartKey,
    weekEndKey: week.weekEndKey,
    refreshVersion: week.refreshVersion,
    todayKey: week.todayKey,
    setTimeZone: week.setTimeZone,
  });
  const actions = useHouseholdChoreActions({
    chores: choresData.chores,
    setChores: choresData.setChores,
    loadChores: choresData.loadChores,
    loadTodayChores: choresData.loadTodayChores,
    timeZone: week.timeZone,
  });

  const { doneChores, totalChores, openChores, progress } = useMemo(
    () => getWeeklyChoreProgress(choresData.chores),
    [choresData.chores],
  );

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
      onAddChoreForDate: actions.onAddChoreForDate,
    },
    addChoreModal: {
      open: actions.showAddModal,
      modalTitle: actions.addModalTitle,
      modalDescription: actions.addModalDescription,
      submitLabel: actions.addModalSubmitLabel,
      submitDisabled: actions.addModalSubmitDisabled,
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
    chorePreviewPopover: {
      todayKey: week.todayKey,
      onPrimaryAction: actions.primaryChoreAction,
      onDeleteChore: actions.deleteChore,
      onSaveDateChanges: actions.saveChoreDateChanges,
      onSaveTitleTypeChanges: actions.saveChoreTitleTypeChanges,
      onSaveNotesChanges: actions.saveChoreNotesChanges,
      onSaveRepeatChanges: actions.saveChoreRepeatChanges,
    },
  };
}
