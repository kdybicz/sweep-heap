"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  findPreviewChoreForTarget,
  getChorePreviewDayOffset,
  getChorePreviewSelectionKey,
  getOpenDetailsPreviewChore,
  getPreviewPopoverChore,
} from "@/app/household/board/chore-preview";
import AccountHeader from "@/app/household/board/components/AccountHeader";
import AddChoreModal from "@/app/household/board/components/AddChoreModal";
import ChoreDetailsModal from "@/app/household/board/components/ChoreDetailsModal";
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
  const [pendingDetailsTarget, setPendingDetailsTarget] = useState<PendingPreviewTarget | null>(
    null,
  );
  const { canSwitchHouseholds, householdIcon, householdName, isHouseholdAdmin, userName } =
    useHouseholdViewer();

  const closePreview = useCallback(() => {
    setPreviewChore(null);
    setPreviewAnchorElement(null);
    setPendingPreviewTarget(null);
    setPendingDetailsTarget(null);
  }, []);

  useEffect(() => {
    if (board.choreDetailsModal.chore) {
      closePreview();
    }
  }, [board.choreDetailsModal.chore, closePreview]);

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
    setPendingPreviewTarget(null);
  }, [board.week.chores, pendingPreviewTarget, previewChore]);

  useEffect(() => {
    if (!pendingDetailsTarget) {
      return;
    }

    if (pendingDetailsTarget.requestedFromChores === board.week.chores) {
      return;
    }

    const previewOffset = previewChore ? getChorePreviewDayOffset(previewChore) : 0;
    const nextPreviewChore = findPreviewChoreForTarget({
      chores: board.week.chores,
      target: pendingDetailsTarget,
      preferredOffset: previewOffset,
    });

    if (!nextPreviewChore) {
      if (!board.week.loading) {
        setPendingDetailsTarget(null);
      }

      return;
    }

    setPreviewChore(nextPreviewChore);
    setPendingPreviewTarget((current) =>
      current?.choreId === pendingDetailsTarget.choreId &&
      current.occurrenceStartDate === pendingDetailsTarget.occurrenceStartDate
        ? null
        : current,
    );
    setPendingDetailsTarget(null);
    board.week.onSelectChore(nextPreviewChore);
  }, [board.week, pendingDetailsTarget, previewChore]);

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
    pendingDetailsTarget,
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
  const openPreviewDetails = useCallback(
    (target?: { choreId: number; occurrenceStartDate: string }) => {
      const latestPreviewChore = getOpenDetailsPreviewChore({
        chores: board.week.chores,
        activePreviewChore,
        target,
      });
      if (!latestPreviewChore) {
        if (target) {
          setPendingPreviewTarget({
            ...target,
            requestedFromChores: board.week.chores,
          });
          setPendingDetailsTarget({
            ...target,
            requestedFromChores: board.week.chores,
          });
        }

        return;
      }

      setPendingDetailsTarget(null);
      board.week.onSelectChore(latestPreviewChore);
    },
    [activePreviewChore, board.week],
  );
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
        return;
      }

      setPendingPreviewTarget({
        ...target,
        requestedFromChores: board.week.chores,
      });
    },
    [activePreviewChore, board.week.chores],
  );

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
            onOpenChoreDetails={board.week.onSelectChore}
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

      <ChoreDetailsModal
        chore={board.choreDetailsModal.chore}
        error={board.choreDetailsModal.error}
        onClose={board.choreDetailsModal.onClose}
        onCancelAction={board.choreDetailsModal.onCancelAction}
        onEditAction={board.choreDetailsModal.onEditAction}
        onPrimaryAction={board.choreDetailsModal.onPrimaryAction}
        submitting={board.choreDetailsModal.submitting}
        todayKey={board.choreDetailsModal.todayKey}
      />
      <ChorePreviewPopover
        anchorElement={previewAnchorElement}
        chore={previewPopoverChore}
        onClose={closePreview}
        onRebindPreviewTarget={rebindPreviewTarget}
        onDeleteChore={board.chorePreviewPopover.onDeleteChore}
        onOpenDetails={openPreviewDetails}
        onSaveDateChanges={board.chorePreviewPopover.onSaveDateChanges}
        onSaveDetailsChanges={board.chorePreviewPopover.onSaveDetailsChanges}
        onSaveNotesChanges={board.chorePreviewPopover.onSaveNotesChanges}
        onSaveRepeatChanges={board.chorePreviewPopover.onSaveRepeatChanges}
        selectionKey={previewSelectionKey}
      />
    </div>
  );
}
