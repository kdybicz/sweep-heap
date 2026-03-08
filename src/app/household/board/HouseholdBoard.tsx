"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import AccountHeader from "@/app/household/board/components/AccountHeader";
import AddChoreModal from "@/app/household/board/components/AddChoreModal";
import ChoreDetailsModal from "@/app/household/board/components/ChoreDetailsModal";
import HouseholdSidebar from "@/app/household/board/components/HouseholdSidebar";
import UndoToastStack from "@/app/household/board/components/UndoToastStack";
import WeekGrid from "@/app/household/board/components/WeekGrid";
import { useHouseholdViewer } from "@/app/household/board/HouseholdViewerContext";
import useHouseholdBoard from "@/app/household/board/useHouseholdBoard";

export default function HouseholdBoard() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HouseholdBoardContent />
    </QueryClientProvider>
  );
}

function HouseholdBoardContent() {
  const board = useHouseholdBoard();
  const { canSwitchHouseholds, householdIcon, householdName, isHouseholdAdmin, userName } =
    useHouseholdViewer();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_85%_5%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_45%)]" />
      <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 pb-10 pt-8 lg:grid-cols-[260px_1fr]">
        <HouseholdSidebar
          doneChores={board.sidebar.doneChores}
          loadingToday={board.sidebar.loadingToday}
          openChores={board.sidebar.openChores}
          progress={board.sidebar.progress}
          today={board.sidebar.today}
          todayChores={board.sidebar.todayChores}
          totalChores={board.sidebar.totalChores}
        />

        <section className="flex flex-col gap-6">
          <AccountHeader
            canEditHousehold={isHouseholdAdmin}
            canSwitchHouseholds={canSwitchHouseholds}
            householdIcon={householdIcon}
            householdName={householdName}
            userName={userName}
          />
          <WeekGrid
            chores={board.week.chores}
            days={board.week.days}
            loading={board.week.loading}
            onAddChoreForDate={board.week.onAddChoreForDate}
            onNextWeek={board.week.onNextWeek}
            onPreviousWeek={board.week.onPreviousWeek}
            onResetWeek={board.sidebar.onResetWeek}
            onSelectChore={board.week.onSelectChore}
            rangeLabel={board.week.rangeLabel}
            today={board.sidebar.today}
          />
        </section>
      </main>

      <UndoToastStack
        nowMs={board.undo.nowMs}
        onUndo={board.undo.onUndo}
        undoToasts={board.undo.undoToasts}
      />

      <AddChoreModal
        fieldErrors={board.addChoreModal.fieldErrors}
        newDate={board.addChoreModal.date}
        newEndDate={board.addChoreModal.endDate}
        newNotes={board.addChoreModal.notes}
        newRepeat={board.addChoreModal.repeat}
        newRepeatEnd={board.addChoreModal.repeatEnd}
        newTitle={board.addChoreModal.title}
        newType={board.addChoreModal.type}
        onCancel={board.addChoreModal.onCancel}
        onClose={board.addChoreModal.onClose}
        onDateChange={board.addChoreModal.onDateChange}
        onEndDateChange={board.addChoreModal.onEndDateChange}
        onNotesChange={board.addChoreModal.onNotesChange}
        onRepeatChange={board.addChoreModal.onRepeatChange}
        onRepeatEndChange={board.addChoreModal.onRepeatEndChange}
        onSubmit={board.addChoreModal.onSubmit}
        onTitleChange={board.addChoreModal.onTitleChange}
        onTypeChange={board.addChoreModal.onTypeChange}
        open={board.addChoreModal.open}
        submitError={board.addChoreModal.submitError}
        submitting={board.addChoreModal.submitting}
      />

      <ChoreDetailsModal
        chore={board.choreDetailsModal.chore}
        onClose={board.choreDetailsModal.onClose}
        onPrimaryAction={board.choreDetailsModal.onPrimaryAction}
        todayKey={board.choreDetailsModal.todayKey}
      />
    </div>
  );
}
