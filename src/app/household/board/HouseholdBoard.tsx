"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  findPreviewChoreForTarget,
  getChorePreviewDayOffset,
  getChorePreviewSelectionKey,
  getPreviewPopoverChore,
} from "@/app/household/board/chore-preview";
import AccountHeader from "@/app/household/board/components/AccountHeader";
import AddChoreModal from "@/app/household/board/components/AddChoreModal";
import ChorePreviewPopover from "@/app/household/board/components/ChorePreviewPopover";
import HouseholdSidebar from "@/app/household/board/components/HouseholdSidebar";
import WeekGrid from "@/app/household/board/components/WeekGrid";
import { useHouseholdViewer } from "@/app/household/board/HouseholdViewerContext";
import type { ChoreItem } from "@/app/household/board/types";
import useHouseholdBoard from "@/app/household/board/useHouseholdBoard";

type PendingPreviewTarget = {
  choreId: number;
  occurrenceStartDate: string;
  requestedFromChores: ChoreItem[];
};

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
  const [previewChore, setPreviewChore] = useState<ChoreItem | null>(null);
  const [previewAnchorElement, setPreviewAnchorElement] = useState<HTMLElement | null>(null);
  const [pendingPreviewTarget, setPendingPreviewTarget] = useState<PendingPreviewTarget | null>(
    null,
  );
  const {
    canManageChores,
    canSwitchHouseholds,
    householdIcon,
    householdName,
    isHouseholdAdmin,
    userName,
  } = useHouseholdViewer();

  const closePreview = useCallback(() => {
    setPreviewChore(null);
    setPreviewAnchorElement(null);
    setPendingPreviewTarget(null);
  }, []);

  const getPreviewAnchorElement = useCallback(
    (target: Pick<ChoreItem, "id" | "occurrence_start_date">) => {
      return document.querySelector<HTMLElement>(
        `[data-chore-preview-id="${target.id}"][data-chore-preview-start="${target.occurrence_start_date}"]`,
      );
    },
    [],
  );

  useEffect(() => {
    if (!pendingPreviewTarget) {
      return;
    }

    if (pendingPreviewTarget.requestedFromChores === board.week.chores) {
      return;
    }

    const previewOffset = previewChore ? getChorePreviewDayOffset(previewChore) : 0;
    const nextPreviewChore = findPreviewChoreForTarget({
      chores: board.week.chores,
      target: pendingPreviewTarget,
      preferredOffset: previewOffset,
    });
    if (!nextPreviewChore) {
      setPendingPreviewTarget(null);
      setPreviewChore(null);
      return;
    }

    setPreviewChore(nextPreviewChore);
    setPreviewAnchorElement(getPreviewAnchorElement(nextPreviewChore));
    setPendingPreviewTarget(null);
  }, [board.week.chores, getPreviewAnchorElement, pendingPreviewTarget, previewChore]);

  const visiblePreviewChore = (() => {
    if (!previewChore) {
      return null;
    }

    const exactMatch = board.week.chores.find(
      (chore) =>
        chore.id === previewChore.id &&
        chore.occurrence_start_date === previewChore.occurrence_start_date &&
        chore.occurrence_date === previewChore.occurrence_date,
    );

    if (exactMatch) {
      return exactMatch;
    }

    if (previewChore.is_repeating) {
      return null;
    }

    const previewOffset = getChorePreviewDayOffset(previewChore);

    return (
      board.week.chores.find(
        (chore) =>
          chore.id === previewChore.id && getChorePreviewDayOffset(chore) === previewOffset,
      ) ?? null
    );
  })();
  const previewPopoverChore = getPreviewPopoverChore({
    previewChore,
    visiblePreviewChore,
    pendingPreviewTarget,
  });
  const activePreviewChore = previewPopoverChore ?? previewChore;

  useEffect(() => {
    if (!visiblePreviewChore || visiblePreviewChore === previewChore) {
      return;
    }

    setPreviewChore(visiblePreviewChore);
  }, [previewChore, visiblePreviewChore]);

  const previewSelectionKey = previewPopoverChore
    ? getChorePreviewSelectionKey(previewPopoverChore)
    : null;
  const rebindPreviewTarget = useCallback(
    (target: { choreId: number; occurrenceStartDate: string }) => {
      const previewOffset = activePreviewChore ? getChorePreviewDayOffset(activePreviewChore) : 0;
      const nextPreviewChore = findPreviewChoreForTarget({
        chores: board.week.chores,
        target,
        preferredOffset: previewOffset,
      });
      if (nextPreviewChore) {
        setPreviewChore(nextPreviewChore);
        setPreviewAnchorElement(getPreviewAnchorElement(nextPreviewChore));
        return;
      }

      setPendingPreviewTarget({
        ...target,
        requestedFromChores: board.week.chores,
      });
    },
    [activePreviewChore, board.week.chores, getPreviewAnchorElement],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="ambient-drift absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_12%,var(--glow-1),transparent_28%),radial-gradient(circle_at_84%_10%,var(--glow-2),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))]" />
      <div className="editorial-grid absolute inset-0 -z-10 opacity-35" />
      <main className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 px-4 pb-12 pt-6 lg:grid-cols-[292px_1fr] lg:gap-6 lg:px-6 lg:pt-8">
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
            canManageChores={canManageChores}
            chores={board.week.chores}
            days={board.week.days}
            loading={board.week.loading}
            onAddChoreForDate={board.week.onAddChoreForDate}
            onNextWeek={board.week.onNextWeek}
            onPreviousWeek={board.week.onPreviousWeek}
            onPreviewChore={(chore, anchorElement) => {
              setPreviewChore(chore);
              setPreviewAnchorElement(anchorElement);
            }}
            onResetWeek={board.sidebar.onResetWeek}
            rangeLabel={board.week.rangeLabel}
            today={board.sidebar.today}
          />
        </section>
      </main>
      <AddChoreModal
        fieldErrors={board.addChoreModal.fieldErrors}
        modalDescription={board.addChoreModal.modalDescription}
        modalTitle={board.addChoreModal.modalTitle}
        submitDisabled={board.addChoreModal.submitDisabled}
        newDate={board.addChoreModal.date}
        newEndDate={board.addChoreModal.endDate}
        newNotes={board.addChoreModal.notes}
        newRepeat={board.addChoreModal.repeat}
        newRepeatEndMode={board.addChoreModal.repeatEndMode}
        newRepeatEnd={board.addChoreModal.repeatEnd}
        newTitle={board.addChoreModal.title}
        newType={board.addChoreModal.type}
        onCancel={board.addChoreModal.onCancel}
        onClose={board.addChoreModal.onClose}
        onDateChange={board.addChoreModal.onDateChange}
        onEndDateChange={board.addChoreModal.onEndDateChange}
        onNotesChange={board.addChoreModal.onNotesChange}
        onRepeatChange={board.addChoreModal.onRepeatChange}
        onRepeatEndModeChange={board.addChoreModal.onRepeatEndModeChange}
        onRepeatEndChange={board.addChoreModal.onRepeatEndChange}
        onSubmit={board.addChoreModal.onSubmit}
        onTitleChange={board.addChoreModal.onTitleChange}
        onTypeChange={board.addChoreModal.onTypeChange}
        open={board.addChoreModal.open}
        submitLabel={board.addChoreModal.submitLabel}
        submitError={board.addChoreModal.submitError}
        submitting={board.addChoreModal.submitting}
      />
      <ChorePreviewPopover
        anchorElement={previewAnchorElement}
        canManageChores={canManageChores}
        chore={previewPopoverChore}
        onClose={closePreview}
        onPrimaryAction={board.chorePreviewPopover.onPrimaryAction}
        onRebindPreviewTarget={rebindPreviewTarget}
        onDeleteChore={board.chorePreviewPopover.onDeleteChore}
        onSaveDateChanges={board.chorePreviewPopover.onSaveDateChanges}
        onSaveTitleTypeChanges={board.chorePreviewPopover.onSaveTitleTypeChanges}
        onSaveNotesChanges={board.chorePreviewPopover.onSaveNotesChanges}
        onSaveRepeatChanges={board.chorePreviewPopover.onSaveRepeatChanges}
        selectionKey={previewSelectionKey}
        todayKey={board.chorePreviewPopover.todayKey}
      />
    </div>
  );
}
