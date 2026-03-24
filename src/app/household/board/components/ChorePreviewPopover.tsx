import { DateTime } from "luxon";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  areChorePreviewDatesDirty,
  areChorePreviewRepeatSettingsDirty,
  areChorePreviewTitleTypeDirty,
  createChorePreviewSaveTrackingState,
  enqueueChorePreviewSave,
  finishChorePreviewSave,
  getChorePreviewDateChangeScopeOptions,
  getChorePreviewDateLabel,
  getChorePreviewFormState,
  getChorePreviewMutationTarget,
  getChorePreviewRepeatChangeScopeOptions,
  getChorePreviewRepeatEndLabelFromState,
  getChorePreviewRepeatLabelFromValue,
  getDefaultPreviewRepeatEndDate,
  getRepeatRuleForPreviewValue,
  isFirstChoreOccurrenceInSeries,
  type PreviewRepeatEndMode,
  type PreviewRepeatValue,
  resetChorePreviewSaveTrackingState,
} from "@/app/household/board/chore-preview";
import { StateIcon } from "@/app/household/board/components/ChoreIcons";
import { addDaysToDateKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";
import type {
  CancelChoreScope,
  EditChoreScope,
} from "@/app/household/board/useHouseholdChoreActions.types";
import {
  type ChoreType,
  getChoreStateLabel,
  getPrimaryActionLabel,
  isPrimaryActionDisabled,
} from "@/lib/chore-ui-state";

type ChorePreviewPopoverProps = {
  chore: ChoreItem | null;
  anchorElement: HTMLElement | null;
  canManageChores: boolean;
  selectionKey: string | null;
  todayKey: string;
  onClose: () => void;
  onPrimaryAction: (chore: ChoreItem) => void;
  onRebindPreviewTarget: (target: { choreId: number; occurrenceStartDate: string }) => void;
  onDeleteChore: (params: {
    choreId: number;
    occurrenceStartDate: string;
    scope: CancelChoreScope;
  }) => Promise<string | null>;
  onSaveDateChanges: (params: {
    chore: ChoreItem;
    scope: EditChoreScope;
    startDate: string;
    endDate: string;
  }) => Promise<{
    error: string | null;
    targetChoreId?: number;
    targetOccurrenceStartDate?: string;
  }>;
  onSaveTitleTypeChanges: (params: {
    chore: ChoreItem;
    scope: EditChoreScope;
    title: string;
    type: ChoreType;
  }) => Promise<{
    error: string | null;
    targetChoreId?: number;
    targetOccurrenceStartDate?: string;
  }>;
  onSaveNotesChanges: (params: {
    chore: ChoreItem;
    scope: EditChoreScope;
    notes: string;
  }) => Promise<{
    error: string | null;
    targetChoreId?: number;
    targetOccurrenceStartDate?: string;
  }>;
  onSaveRepeatChanges: (params: {
    chore: ChoreItem;
    scope: EditChoreScope;
    repeatRule: string;
    seriesEndDate: string | null;
  }) => Promise<{
    error: string | null;
    targetChoreId?: number;
    targetOccurrenceStartDate?: string;
  }>;
};

type ScopePopupMode = "date" | "titleType" | "repeat" | "notes" | "delete";

type PreviewSavePostAction = "none" | "close" | "delete";

type PreviewSaveBehavior = {
  closeAfter: boolean;
  collapseAfter: boolean;
  postAction: PreviewSavePostAction;
};

type DeleteTargetOverride = {
  choreId: number;
  occurrenceStartDate: string;
  isRepeating: boolean;
  isFirstInSeries: boolean;
};

type ActivePreviewSelection = {
  selectionKey: string | null;
  sessionId: number;
};

const formatPreviewInputDate = (value: string) => {
  const parsed = DateTime.fromISO(value, { zone: "UTC" });
  if (!parsed.isValid) {
    return value;
  }

  return parsed.toFormat("dd/MM/yyyy");
};

type InlineDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  minWidthClassName?: string;
  disabled?: boolean;
  min?: string;
};

function InlineDateField({
  value,
  onChange,
  minWidthClassName = "min-w-[7.75rem]",
  disabled = false,
  min,
}: InlineDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative inline-flex ${minWidthClassName} rounded-md border border-transparent transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[inset_0_0_0_1px_var(--stroke-soft)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent)] ${disabled ? "opacity-60" : ""}`}
    >
      <button
        className="w-full rounded-md px-2 py-0.5 text-left text-[0.88rem] font-medium text-[var(--ink)] outline-none"
        disabled={disabled}
        onClick={() => {
          const input = inputRef.current;
          if (!input) {
            return;
          }

          if (typeof input.showPicker === "function") {
            input.showPicker();
            return;
          }

          input.click();
        }}
        type="button"
      >
        {formatPreviewInputDate(value)}
      </button>
      <input
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        disabled={disabled}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />
    </div>
  );
}

function InlineSelectField({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inline-flex rounded-md border border-transparent transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[inset_0_0_0_1px_var(--stroke-soft)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent)] ${disabled ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.5 6.5v7m3-7v7m3-7v7M4.5 5h11m-7-2h3m-5.5 2 .5 10.5c.04.8.7 1.5 1.5 1.5h3.9c.8 0 1.46-.63 1.5-1.43L14 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function ChorePreviewPopover({
  chore,
  anchorElement,
  canManageChores,
  selectionKey,
  todayKey,
  onClose,
  onPrimaryAction,
  onRebindPreviewTarget,
  onDeleteChore,
  onSaveDateChanges,
  onSaveTitleTypeChanges,
  onSaveNotesChanges,
  onSaveRepeatChanges,
}: ChorePreviewPopoverProps) {
  const initialFormState = chore
    ? getChorePreviewFormState(chore)
    : {
        startDate: "",
        endDate: "",
        repeat: "none" as PreviewRepeatValue,
        repeatEndMode: "never" as PreviewRepeatEndMode,
        repeatEnd: "",
      };
  const popoverRef = useRef<HTMLDivElement>(null);
  const editPaneRef = useRef<HTMLDivElement>(null);
  const repeatEditorRef = useRef<HTMLDivElement>(null);
  const titleEditorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesEditorRef = useRef<HTMLDivElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const scopePopupRef = useRef<HTMLDivElement>(null);
  const saveTrackingRef = useRef(createChorePreviewSaveTrackingState());
  const pendingTitleBlurBehaviorRef = useRef<PreviewSaveBehavior | null>(null);
  const pendingNotesBlurBehaviorRef = useRef<PreviewSaveBehavior | null>(null);
  const suppressNextFooterActionRef = useRef<PreviewSavePostAction | null>(null);
  const activeSelectionRef = useRef<ActivePreviewSelection>({
    selectionKey,
    sessionId: 0,
  });
  const previousSelectionKeyRef = useRef<string | null>(null);
  const discardOnBlurRef = useRef(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [startDate, setStartDate] = useState(initialFormState.startDate);
  const [endDate, setEndDate] = useState(initialFormState.endDate);
  const [titleDraft, setTitleDraft] = useState(chore?.title ?? "");
  const [type, setType] = useState<ChoreType>(chore?.type ?? "close_on_done");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleTypeSaveBehavior, setTitleTypeSaveBehavior] = useState<PreviewSaveBehavior | null>(
    null,
  );
  const [repeatSaveBehavior, setRepeatSaveBehavior] = useState<PreviewSaveBehavior | null>(null);
  const [repeat, setRepeat] = useState<PreviewRepeatValue>(initialFormState.repeat);
  const [repeatEndMode, setRepeatEndMode] = useState<PreviewRepeatEndMode>(
    initialFormState.repeatEndMode,
  );
  const [repeatEnd, setRepeatEnd] = useState(initialFormState.repeatEnd);
  const [deleteTargetOverride, setDeleteTargetOverride] = useState<DeleteTargetOverride | null>(
    null,
  );
  const [notesDraft, setNotesDraft] = useState(chore?.notes ?? "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesSaveBehavior, setNotesSaveBehavior] = useState<PreviewSaveBehavior | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scopePopupMode, setScopePopupMode] = useState<ScopePopupMode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetPreviewFields = useCallback(() => {
    if (!chore) {
      return;
    }

    const nextState = getChorePreviewFormState(chore);
    setTitleDraft(chore.title);
    setType(chore.type);
    setIsEditingTitle(false);
    setTitleTypeSaveBehavior(null);
    setRepeatSaveBehavior(null);
    setStartDate(nextState.startDate);
    setEndDate(nextState.endDate);
    setRepeat(nextState.repeat);
    setRepeatEndMode(nextState.repeatEndMode);
    setRepeatEnd(nextState.repeatEnd);
    setDeleteTargetOverride(null);
    setNotesDraft(chore.notes ?? "");
    setIsEditingNotes(false);
    setNotesSaveBehavior(null);
    pendingTitleBlurBehaviorRef.current = null;
    pendingNotesBlurBehaviorRef.current = null;
    suppressNextFooterActionRef.current = null;
    setSaveError(null);
    setScopePopupMode(null);
    setIsSaving(false);
  }, [chore]);

  const collapseToViewPane = useCallback(() => {
    resetPreviewFields();
    setIsExpanded(false);
  }, [resetPreviewFields]);

  const invalidateActiveSelection = useCallback(() => {
    activeSelectionRef.current = {
      selectionKey: null,
      sessionId: activeSelectionRef.current.sessionId + 1,
    };
  }, []);

  const resetSaveTracking = useCallback(() => {
    saveTrackingRef.current = resetChorePreviewSaveTrackingState(saveTrackingRef.current);
    setIsSaving(false);
  }, []);

  const getSelectionSnapshot = useCallback(() => {
    return activeSelectionRef.current;
  }, []);

  const enqueueSave = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const nextSave = enqueueChorePreviewSave({
      state: saveTrackingRef.current,
      task,
    });
    saveTrackingRef.current = nextSave.state;
    setIsSaving(true);

    return nextSave.promise.finally(() => {
      const finishedSave = finishChorePreviewSave({
        state: saveTrackingRef.current,
        sessionId: nextSave.sessionId,
      });
      saveTrackingRef.current = finishedSave.state;
      if (!finishedSave.isSaving) {
        setIsSaving(false);
      }
    });
  }, []);

  const isSelectionStillCurrent = useCallback(
    (snapshot: ActivePreviewSelection) => {
      return (
        activeSelectionRef.current.selectionKey === selectionKey &&
        activeSelectionRef.current.selectionKey === snapshot.selectionKey &&
        activeSelectionRef.current.sessionId === snapshot.sessionId
      );
    },
    [selectionKey],
  );

  const focusAnchorElement = useCallback(() => {
    const nextAnchorElement = chore
      ? document.querySelector<HTMLElement>(
          `[data-chore-preview-id="${chore.id}"][data-chore-preview-start="${chore.occurrence_start_date}"]`,
        )
      : null;

    if (nextAnchorElement?.isConnected) {
      nextAnchorElement.focus();
      return;
    }

    if (!(anchorElement instanceof HTMLElement) || !anchorElement.isConnected) {
      return;
    }

    anchorElement.focus();
  }, [anchorElement, chore]);

  const closePreview = useCallback(() => {
    onClose();
    focusAnchorElement();
  }, [focusAnchorElement, onClose]);

  const closePreviewIfSelectionMatches = useCallback(
    (selectionSnapshot: ActivePreviewSelection = activeSelectionRef.current) => {
      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return false;
      }

      invalidateActiveSelection();
      closePreview();
      return true;
    },
    [closePreview, invalidateActiveSelection, isSelectionStillCurrent],
  );

  const discardAndClosePreview = useCallback(() => {
    discardOnBlurRef.current = true;
    resetPreviewFields();
    closePreviewIfSelectionMatches();
  }, [closePreviewIfSelectionMatches, resetPreviewFields]);

  const getSaveBehaviorForTarget = useCallback(
    (target: EventTarget | null): PreviewSaveBehavior => {
      const node = target instanceof Node ? target : null;
      const actionTrigger =
        node instanceof Element ? node.closest<HTMLElement>("[data-preview-post-action]") : null;
      const postAction = (actionTrigger?.dataset.previewPostAction ??
        "none") as PreviewSavePostAction;

      if (postAction !== "none") {
        return {
          closeAfter: postAction === "close",
          collapseAfter: false,
          postAction,
        };
      }

      if (node && editPaneRef.current?.contains(node)) {
        return { closeAfter: false, collapseAfter: false, postAction: "none" };
      }

      if (node && popoverRef.current?.contains(node)) {
        return { closeAfter: false, collapseAfter: true, postAction: "none" };
      }

      return { closeAfter: true, collapseAfter: isExpanded, postAction: "close" };
    },
    [isExpanded],
  );

  const hasPendingRepeatSettings =
    !!chore &&
    !isSaving &&
    scopePopupMode === null &&
    areChorePreviewRepeatSettingsDirty(chore, {
      repeat,
      repeatEndMode,
      repeatEnd,
    });

  const flushPendingRepeatSettings = useCallback(
    (
      {
        closeAfter = false,
        collapseAfter = false,
        postAction = closeAfter ? "close" : "none",
      }: PreviewSaveBehavior = {
        closeAfter: false,
        collapseAfter: false,
        postAction: "none",
      },
    ) => {
      if (!chore) {
        if (closeAfter) {
          closePreview();
        } else if (collapseAfter) {
          setIsExpanded(false);
        }
        return;
      }

      if (!hasPendingRepeatSettings) {
        if (closeAfter) {
          closePreview();
        } else if (collapseAfter) {
          setIsExpanded(false);
        }
        return;
      }

      if (!chore.is_repeating) {
        setSaveError(null);
        const selectionSnapshot = getSelectionSnapshot();
        void enqueueSave(() =>
          onSaveRepeatChanges({
            chore,
            scope: "all",
            repeatRule: getRepeatRuleForPreviewValue(repeat),
            seriesEndDate: repeat === "none" || repeatEndMode !== "on_date" ? null : repeatEnd,
          }),
        ).then((error) => {
          if (!isSelectionStillCurrent(selectionSnapshot)) {
            return;
          }

          if (error.error) {
            setSaveError(error.error);
            return;
          }

          if (postAction === "delete") {
            const deleteSelectionSnapshot = getSelectionSnapshot();
            void enqueueSave(() =>
              onDeleteChore({
                choreId: chore.id,
                occurrenceStartDate: chore.occurrence_start_date,
                scope: "single",
              }),
            ).then((deleteError) => {
              if (!isSelectionStillCurrent(deleteSelectionSnapshot)) {
                return;
              }

              if (deleteError) {
                setSaveError(deleteError);
                return;
              }

              closePreviewIfSelectionMatches();
            });
            return;
          }

          if (collapseAfter) {
            setIsExpanded(false);
          }

          if (closeAfter || postAction === "close") {
            closePreviewIfSelectionMatches();
          }
        });
        return;
      }

      setSaveError(null);
      setRepeatSaveBehavior({ closeAfter, collapseAfter, postAction });
      setScopePopupMode("repeat");
    },
    [
      chore,
      closePreviewIfSelectionMatches,
      enqueueSave,
      getSelectionSnapshot,
      hasPendingRepeatSettings,
      isSelectionStillCurrent,
      closePreview,
      onDeleteChore,
      onSaveRepeatChanges,
      repeat,
      repeatEnd,
      repeatEndMode,
    ],
  );

  const getCurrentDateSpanDays = useCallback(() => {
    const start = DateTime.fromISO(startDate, { zone: "UTC" });
    const end = DateTime.fromISO(endDate, { zone: "UTC" });

    if (!start.isValid || !end.isValid) {
      return chore?.duration_days ?? 1;
    }

    return Math.max(Math.round(end.diff(start, "days").days) + 1, 1);
  }, [chore?.duration_days, endDate, startDate]);

  const previewAnchorSelector = useCallback((targetChore: ChoreItem) => {
    return `[data-chore-preview-id="${targetChore.id}"][data-chore-preview-start="${targetChore.occurrence_start_date}"]`;
  }, []);

  const beginDeleteFlow = useCallback(() => {
    if (!chore) {
      return;
    }

    setSaveError(null);

    if (chore.is_repeating) {
      setScopePopupMode("delete");
      return;
    }

    setScopePopupMode(null);
    const selectionSnapshot = getSelectionSnapshot();
    void enqueueSave(() =>
      onDeleteChore({
        choreId: chore.id,
        occurrenceStartDate: chore.occurrence_start_date,
        scope: "single",
      }),
    ).then((error) => {
      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return;
      }

      if (error) {
        setSaveError(error);
        pendingNotesBlurBehaviorRef.current = null;
        suppressNextFooterActionRef.current = null;
        return;
      }

      closePreviewIfSelectionMatches();
    });
  }, [
    chore,
    closePreviewIfSelectionMatches,
    enqueueSave,
    getSelectionSnapshot,
    isSelectionStillCurrent,
    onDeleteChore,
  ]);

  const handleSaveBehaviorAfterMutation = useCallback(
    async ({
      scope,
      behavior,
      target,
      selectionSnapshot,
    }: {
      scope: EditChoreScope;
      behavior: PreviewSaveBehavior | null;
      target: { choreId: number; occurrenceStartDate: string } | null;
      selectionSnapshot: ActivePreviewSelection;
    }) => {
      if (scope !== "all" && target) {
        onRebindPreviewTarget(target);
      }

      if (behavior?.postAction === "delete") {
        if (scope !== "all" && target) {
          if (scope === "single") {
            const deleteError = await enqueueSave(() =>
              onDeleteChore({
                choreId: target.choreId,
                occurrenceStartDate: target.occurrenceStartDate,
                scope: "single",
              }),
            );

            if (!isSelectionStillCurrent(selectionSnapshot)) {
              return true;
            }

            if (deleteError) {
              setSaveError(deleteError);
              return true;
            }

            closePreviewIfSelectionMatches();
            return true;
          }

          setDeleteTargetOverride({
            choreId: target.choreId,
            occurrenceStartDate: target.occurrenceStartDate,
            isRepeating: true,
            isFirstInSeries: true,
          });
          setScopePopupMode("delete");
          return true;
        }

        beginDeleteFlow();
        return true;
      }

      if (behavior?.collapseAfter) {
        setIsExpanded(false);
      }

      if (behavior?.closeAfter || behavior?.postAction === "close") {
        closePreviewIfSelectionMatches();
        return true;
      }

      return false;
    },
    [
      beginDeleteFlow,
      closePreviewIfSelectionMatches,
      enqueueSave,
      isSelectionStillCurrent,
      onDeleteChore,
      onRebindPreviewTarget,
    ],
  );

  const submitTitleTypeChanges = useCallback(
    async (scope: EditChoreScope) => {
      if (!chore) {
        return;
      }

      setSaveError(null);
      setScopePopupMode(null);
      const selectionSnapshot = getSelectionSnapshot();

      const result = await enqueueSave(() =>
        onSaveTitleTypeChanges({
          chore,
          scope,
          title: titleDraft,
          type,
        }),
      );

      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return;
      }

      if (result.error) {
        setSaveError(result.error);
        setIsEditingTitle(true);
        pendingTitleBlurBehaviorRef.current = null;
        suppressNextFooterActionRef.current = null;
        return;
      }

      const target = getChorePreviewMutationTarget({
        chore,
        targetChoreId: result.targetChoreId,
        targetOccurrenceStartDate: result.targetOccurrenceStartDate,
      });

      if (
        await handleSaveBehaviorAfterMutation({
          scope,
          behavior: titleTypeSaveBehavior,
          target,
          selectionSnapshot,
        })
      ) {
        return;
      }

      setTitleTypeSaveBehavior(null);
      pendingTitleBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
    },
    [
      chore,
      enqueueSave,
      getSelectionSnapshot,
      handleSaveBehaviorAfterMutation,
      isSelectionStillCurrent,
      onSaveTitleTypeChanges,
      titleDraft,
      titleTypeSaveBehavior,
      type,
    ],
  );

  const commitTitleChanges = useCallback(
    async ({
      closeAfter = false,
      collapseAfter = false,
      postAction = closeAfter ? "close" : "none",
    }: {
      closeAfter?: boolean;
      collapseAfter?: boolean;
      postAction?: PreviewSavePostAction;
    } = {}) => {
      if (!chore || !isEditingTitle) {
        if (collapseAfter) {
          collapseToViewPane();
        }
        if (closeAfter) {
          closePreview();
        }
        return;
      }

      setIsEditingTitle(false);

      if (!areChorePreviewTitleTypeDirty(chore, { title: titleDraft, type })) {
        if (postAction === "delete") {
          beginDeleteFlow();
          return;
        }

        if (collapseAfter) {
          collapseToViewPane();
        }
        if (closeAfter) {
          closePreview();
        }
        return;
      }

      if (chore.is_repeating) {
        setSaveError(null);
        setTitleTypeSaveBehavior({ closeAfter, collapseAfter, postAction });
        setScopePopupMode("titleType");
        return;
      }

      setSaveError(null);
      const selectionSnapshot = getSelectionSnapshot();
      const result = await enqueueSave(() =>
        onSaveTitleTypeChanges({
          chore,
          scope: "all",
          title: titleDraft,
          type,
        }),
      );

      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return;
      }

      if (result.error) {
        setSaveError(result.error);
        pendingTitleBlurBehaviorRef.current = null;
        suppressNextFooterActionRef.current = null;
        return;
      }

      if (postAction === "delete") {
        beginDeleteFlow();
        return;
      }
      if (collapseAfter) {
        setIsExpanded(false);
      }
      if (closeAfter || postAction === "close") {
        closePreviewIfSelectionMatches();
      }

      pendingTitleBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
    },
    [
      beginDeleteFlow,
      chore,
      closePreviewIfSelectionMatches,
      collapseToViewPane,
      enqueueSave,
      getSelectionSnapshot,
      isEditingTitle,
      isSelectionStillCurrent,
      closePreview,
      onSaveTitleTypeChanges,
      titleDraft,
      type,
    ],
  );

  const commitNotesChanges = useCallback(
    async ({
      closeAfter = false,
      collapseAfter = false,
      postAction = closeAfter ? "close" : "none",
    }: {
      closeAfter?: boolean;
      collapseAfter?: boolean;
      postAction?: PreviewSavePostAction;
    } = {}) => {
      if (!chore || !isEditingNotes) {
        if (collapseAfter) {
          collapseToViewPane();
        }
        if (closeAfter) {
          closePreview();
        }
        return;
      }

      const nextNotes = notesDraft.trim();
      const savedNotes = (chore.notes ?? "").trim();

      setIsEditingNotes(false);

      if (nextNotes === savedNotes) {
        if (postAction === "delete") {
          beginDeleteFlow();
          return;
        }

        if (collapseAfter) {
          collapseToViewPane();
        }
        if (closeAfter) {
          closePreview();
        }
        return;
      }

      if (chore.is_repeating) {
        setSaveError(null);
        setNotesSaveBehavior({ closeAfter, collapseAfter, postAction });
        setScopePopupMode("notes");
        return;
      }

      setSaveError(null);
      const selectionSnapshot = getSelectionSnapshot();
      const result = await enqueueSave(() =>
        onSaveNotesChanges({
          chore,
          scope: "all",
          notes: notesDraft,
        }),
      );

      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return;
      }

      if (result.error) {
        setSaveError(result.error);
        pendingNotesBlurBehaviorRef.current = null;
        suppressNextFooterActionRef.current = null;
        return;
      }

      if (postAction === "delete") {
        beginDeleteFlow();
        return;
      }

      if (collapseAfter) {
        setIsExpanded(false);
      }
      if (closeAfter || postAction === "close") {
        closePreviewIfSelectionMatches();
      }

      pendingNotesBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
    },
    [
      beginDeleteFlow,
      chore,
      closePreviewIfSelectionMatches,
      collapseToViewPane,
      enqueueSave,
      getSelectionSnapshot,
      isEditingNotes,
      isSelectionStillCurrent,
      notesDraft,
      closePreview,
      onSaveNotesChanges,
    ],
  );

  useEffect(() => {
    if (chore) {
      return;
    }

    invalidateActiveSelection();
    resetSaveTracking();
    previousSelectionKeyRef.current = null;
    pendingTitleBlurBehaviorRef.current = null;
    pendingNotesBlurBehaviorRef.current = null;
    suppressNextFooterActionRef.current = null;
    discardOnBlurRef.current = false;
    setIsExpanded(false);
    setIsEditingTitle(false);
    setTitleTypeSaveBehavior(null);
    setRepeatSaveBehavior(null);
    setDeleteTargetOverride(null);
    setIsEditingNotes(false);
    setNotesSaveBehavior(null);
    setScopePopupMode(null);
  }, [chore, invalidateActiveSelection, resetSaveTracking]);

  useEffect(() => {
    if (!chore || !anchorElement) {
      setAnchorRect(null);
      return;
    }

    const updateRect = () => {
      const nextAnchorElement =
        (document.querySelector(previewAnchorSelector(chore)) as HTMLElement | null) ??
        (anchorElement.isConnected ? anchorElement : null);

      if (!nextAnchorElement) {
        closePreview();
        return;
      }

      setAnchorRect(nextAnchorElement.getBoundingClientRect());
    };

    updateRect();

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [anchorElement, chore, closePreview, previewAnchorSelector]);

  useEffect(() => {
    if (!chore) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (isSaving) {
        return;
      }

      if (popoverRef.current?.contains(event.target as Node)) {
        return;
      }
      if (scopePopupRef.current?.contains(event.target as Node)) {
        return;
      }

      if (hasPendingRepeatSettings) {
        flushPendingRepeatSettings({
          closeAfter: true,
          collapseAfter: isExpanded,
          postAction: "close",
        });
        return;
      }

      if (isEditingTitle) {
        pendingTitleBlurBehaviorRef.current = {
          closeAfter: true,
          collapseAfter: isExpanded,
          postAction: "close",
        };
        return;
      }

      if (isEditingNotes) {
        pendingNotesBlurBehaviorRef.current = {
          closeAfter: true,
          collapseAfter: isExpanded,
          postAction: "close",
        };
        return;
      }

      if (isExpanded) {
        collapseToViewPane();
      }

      closePreview();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isSaving) {
          return;
        }

        event.preventDefault();
        discardAndClosePreview();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    chore,
    collapseToViewPane,
    closePreview,
    flushPendingRepeatSettings,
    hasPendingRepeatSettings,
    isEditingNotes,
    isEditingTitle,
    isExpanded,
    isSaving,
    discardAndClosePreview,
  ]);

  useEffect(() => {
    if (!chore || !selectionKey) {
      return;
    }

    const nextState = getChorePreviewFormState(chore);
    const isSameSelection = previousSelectionKeyRef.current === selectionKey;
    const nextSessionId = isSameSelection
      ? activeSelectionRef.current.sessionId
      : activeSelectionRef.current.sessionId + 1;

    if (!isSameSelection) {
      setIsExpanded(false);
      resetSaveTracking();
    }
    setTitleDraft(chore.title);
    setType(chore.type);
    setIsEditingTitle(false);
    setTitleTypeSaveBehavior(null);
    setRepeatSaveBehavior(null);
    setStartDate(nextState.startDate);
    setEndDate(nextState.endDate);
    setRepeat(nextState.repeat);
    setRepeatEndMode(nextState.repeatEndMode);
    setRepeatEnd(nextState.repeatEnd);
    setDeleteTargetOverride(null);
    setNotesDraft(chore.notes ?? "");
    setIsEditingNotes(false);
    setNotesSaveBehavior(null);
    setSaveError(null);
    setScopePopupMode(null);
    pendingTitleBlurBehaviorRef.current = null;
    discardOnBlurRef.current = false;
    activeSelectionRef.current = {
      selectionKey,
      sessionId: nextSessionId,
    };
    previousSelectionKeyRef.current = selectionKey;
  }, [chore, resetSaveTracking, selectionKey]);

  useEffect(() => {
    activeSelectionRef.current = {
      ...activeSelectionRef.current,
      selectionKey,
    };
  }, [selectionKey]);

  useEffect(() => {
    if (!startDate || !endDate || endDate >= startDate) {
      return;
    }

    setEndDate(startDate);
  }, [endDate, startDate]);

  useEffect(() => {
    if (canManageChores) {
      return;
    }

    setIsEditingTitle(false);
    setIsEditingNotes(false);
    setIsExpanded(false);
    setScopePopupMode(null);
  }, [canManageChores]);

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }

    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingNotes) {
      return;
    }

    notesInputRef.current?.focus();
  }, [isEditingNotes]);

  useEffect(() => {
    if (!chore || !selectionKey || isEditingTitle || isEditingNotes) {
      return;
    }

    popoverRef.current?.focus();
  }, [chore, isEditingNotes, isEditingTitle, selectionKey]);

  const currentAnchorRect = anchorRect ?? anchorElement?.getBoundingClientRect() ?? null;

  if (!chore || !currentAnchorRect) {
    return null;
  }

  const repeatLabel = getChorePreviewRepeatLabelFromValue(repeat);
  const statusLabel = getChoreStateLabel(chore);
  const trimmedTitleDraft = titleDraft.trim();
  const trimmedNotesDraft = notesDraft.trim();
  const showExpandedEditor = canManageChores && isExpanded;
  const isInteractionLocked = isSaving || scopePopupMode !== null;
  const isDateInteractionLocked =
    isSaving || (scopePopupMode !== null && scopePopupMode !== "date");
  const isPrimaryActionLocked =
    isInteractionLocked || isEditingTitle || isEditingNotes || hasPendingRepeatSettings;
  const primaryActionButtonDisabled =
    isPrimaryActionLocked ||
    isPrimaryActionDisabled({
      chore,
      todayKey,
    });
  const deleteTarget = deleteTargetOverride ?? {
    choreId: chore.id,
    occurrenceStartDate: chore.occurrence_start_date,
    isRepeating: chore.is_repeating,
    isFirstInSeries: isFirstChoreOccurrenceInSeries(chore),
  };
  const deleteScopeOptions: Array<{ scope: CancelChoreScope; label: string }> =
    deleteTarget.isRepeating
      ? deleteTarget.isFirstInSeries
        ? [
            { scope: "single", label: "Only current chore" },
            { scope: "all", label: "All chores" },
          ]
        : [
            { scope: "single", label: "Only current chore" },
            { scope: "following", label: "All future chores" },
            { scope: "all", label: "All chores" },
          ]
      : [{ scope: "single", label: "Only current chore" }];
  const scopeOptions =
    scopePopupMode === "date"
      ? getChorePreviewDateChangeScopeOptions(chore)
      : scopePopupMode === "titleType"
        ? getChorePreviewDateChangeScopeOptions(chore)
        : scopePopupMode === "notes"
          ? getChorePreviewDateChangeScopeOptions(chore)
          : scopePopupMode === "delete"
            ? deleteScopeOptions
            : getChorePreviewRepeatChangeScopeOptions(chore);
  const preferredWidth = showExpandedEditor ? 388 : 320;
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const popoverWidth = Math.min(preferredWidth, viewportWidth - 32);
  const estimatedHeight =
    showExpandedEditor && repeat !== "none"
      ? saveError
        ? 430
        : 390
      : showExpandedEditor
        ? saveError
          ? 440
          : 400
        : chore.notes
          ? 290
          : 240;
  const left = Math.min(Math.max(currentAnchorRect.left, 16), viewportWidth - popoverWidth - 16);
  const prefersAbove = currentAnchorRect.bottom + estimatedHeight + 16 > viewportHeight;
  const top = prefersAbove
    ? Math.max(currentAnchorRect.top - estimatedHeight - 12, 16)
    : Math.min(currentAnchorRect.bottom + 12, viewportHeight - estimatedHeight - 16);
  const notchLeft = Math.min(
    Math.max(currentAnchorRect.left + currentAnchorRect.width / 2 - left - 9, 22),
    popoverWidth - 34,
  );
  const scopePopupWidth = Math.min(288, viewportWidth - 32);
  const scopePopupHeight = 218;
  const fitsScopePopupRight = left + popoverWidth + 12 + scopePopupWidth <= viewportWidth - 16;
  const fitsScopePopupLeft = left - scopePopupWidth - 12 >= 16;
  const scopePopupLeft = fitsScopePopupRight
    ? left + popoverWidth + 12
    : fitsScopePopupLeft
      ? left - scopePopupWidth - 12
      : Math.min(Math.max(left, 16), viewportWidth - scopePopupWidth - 16);
  const scopePopupTop =
    !fitsScopePopupRight && !fitsScopePopupLeft
      ? Math.min(top + estimatedHeight + 12, Math.max(viewportHeight - scopePopupHeight - 16, 16))
      : Math.min(Math.max(top + 88, 16), viewportHeight - scopePopupHeight - 16);

  const submitDateChanges = async (scope: EditChoreScope) => {
    setSaveError(null);
    setScopePopupMode(null);
    const selectionSnapshot = getSelectionSnapshot();

    const result = await enqueueSave(() =>
      onSaveDateChanges({
        chore,
        scope,
        startDate,
        endDate,
      }),
    );

    if (!isSelectionStillCurrent(selectionSnapshot)) {
      return;
    }

    if (result.error) {
      setSaveError(result.error);
      pendingNotesBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
      return;
    }

    if (scope !== "all" && result.targetChoreId) {
      onRebindPreviewTarget({
        choreId: result.targetChoreId,
        occurrenceStartDate: result.targetOccurrenceStartDate ?? chore.occurrence_start_date,
      });
      return;
    }

    closePreviewIfSelectionMatches();
  };

  const submitRepeatChanges = async (scope: EditChoreScope) => {
    setSaveError(null);
    setScopePopupMode(null);
    const selectionSnapshot = getSelectionSnapshot();

    const result = await enqueueSave(() =>
      onSaveRepeatChanges({
        chore,
        scope,
        repeatRule: getRepeatRuleForPreviewValue(repeat),
        seriesEndDate: repeat === "none" || repeatEndMode !== "on_date" ? null : repeatEnd,
      }),
    );

    if (!isSelectionStillCurrent(selectionSnapshot)) {
      return;
    }

    if (result.error) {
      setSaveError(result.error);
      pendingNotesBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
      return;
    }

    const target = getChorePreviewMutationTarget({
      chore,
      targetChoreId: result.targetChoreId,
      targetOccurrenceStartDate: result.targetOccurrenceStartDate,
    });

    if (
      await handleSaveBehaviorAfterMutation({
        scope,
        behavior: repeatSaveBehavior,
        target,
        selectionSnapshot,
      })
    ) {
      return;
    }

    setRepeatSaveBehavior(null);
  };

  const submitNotesChanges = async (scope: EditChoreScope) => {
    setSaveError(null);
    setScopePopupMode(null);
    const selectionSnapshot = getSelectionSnapshot();

    const result = await enqueueSave(() =>
      onSaveNotesChanges({
        chore,
        scope,
        notes: notesDraft,
      }),
    );

    if (!isSelectionStillCurrent(selectionSnapshot)) {
      return;
    }

    if (result.error) {
      setSaveError(result.error);
      pendingNotesBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
      return;
    }

    const target = getChorePreviewMutationTarget({
      chore,
      targetChoreId: result.targetChoreId,
      targetOccurrenceStartDate: result.targetOccurrenceStartDate,
    });

    if (
      await handleSaveBehaviorAfterMutation({
        scope,
        behavior: notesSaveBehavior,
        target,
        selectionSnapshot,
      })
    ) {
      return;
    }

    setNotesSaveBehavior(null);
    pendingNotesBlurBehaviorRef.current = null;
    suppressNextFooterActionRef.current = null;
  };

  const submitDeleteChore = async (scope: CancelChoreScope) => {
    setSaveError(null);
    setScopePopupMode(null);
    const selectionSnapshot = getSelectionSnapshot();

    const error = await enqueueSave(() =>
      onDeleteChore({
        choreId: deleteTarget.choreId,
        occurrenceStartDate: deleteTarget.occurrenceStartDate,
        scope,
      }),
    );

    if (!isSelectionStillCurrent(selectionSnapshot)) {
      return;
    }

    if (error) {
      setSaveError(error);
      pendingNotesBlurBehaviorRef.current = null;
      suppressNextFooterActionRef.current = null;
      return;
    }

    closePreviewIfSelectionMatches();
  };

  const queueDateSave = (nextStartDate: string, nextEndDate: string) => {
    if (
      isSaving ||
      (scopePopupMode !== null && scopePopupMode !== "date") ||
      !areChorePreviewDatesDirty(chore, {
        startDate: nextStartDate,
        endDate: nextEndDate,
      })
    ) {
      return;
    }

    if (!chore.is_repeating) {
      setSaveError(null);
      const selectionSnapshot = getSelectionSnapshot();
      void enqueueSave(() =>
        onSaveDateChanges({
          chore,
          scope: "all",
          startDate: nextStartDate,
          endDate: nextEndDate,
        }),
      ).then((result) => {
        if (!isSelectionStillCurrent(selectionSnapshot)) {
          return;
        }

        if (result.error) {
          setSaveError(result.error);
          return;
        }

        if (result.targetChoreId) {
          onRebindPreviewTarget({
            choreId: result.targetChoreId,
            occurrenceStartDate: result.targetOccurrenceStartDate ?? chore.occurrence_start_date,
          });
        }
      });
      return;
    }

    setSaveError(null);
    if (scopePopupMode !== "date") {
      setScopePopupMode("date");
    }
  };

  const queueRepeatSave = (
    nextRepeat: PreviewRepeatValue,
    nextRepeatEndMode: PreviewRepeatEndMode,
    nextRepeatEnd: string,
  ) => {
    if (
      isInteractionLocked ||
      !areChorePreviewRepeatSettingsDirty(chore, {
        repeat: nextRepeat,
        repeatEndMode: nextRepeatEndMode,
        repeatEnd: nextRepeatEnd,
      })
    ) {
      return;
    }

    if (!chore.is_repeating) {
      setSaveError(null);
      const selectionSnapshot = getSelectionSnapshot();
      void enqueueSave(() =>
        onSaveRepeatChanges({
          chore,
          scope: "all",
          repeatRule: getRepeatRuleForPreviewValue(nextRepeat),
          seriesEndDate:
            nextRepeat === "none" || nextRepeatEndMode !== "on_date" ? null : nextRepeatEnd,
        }),
      ).then((result) => {
        if (!isSelectionStillCurrent(selectionSnapshot)) {
          return;
        }

        if (result.error) {
          setSaveError(result.error);
        }
      });
      return;
    }

    setSaveError(null);
    setScopePopupMode("repeat");
  };

  const handleStartDateChange = (value: string) => {
    if (!value) {
      return;
    }

    const nextEndDate = addDaysToDateKey(value, getCurrentDateSpanDays() - 1);
    setStartDate(value);
    setEndDate(nextEndDate);
    queueDateSave(value, nextEndDate);
  };

  const handleEndDateChange = (value: string) => {
    if (!value) {
      return;
    }

    const nextEndDate = value < startDate ? startDate : value;
    setEndDate(nextEndDate);
    queueDateSave(startDate, nextEndDate);
  };

  const handleTypeChange = (value: ChoreType) => {
    setType(value);

    if (
      !chore ||
      scopePopupMode !== null ||
      !areChorePreviewTitleTypeDirty(chore, { title: titleDraft, type: value })
    ) {
      return;
    }

    setSaveError(null);
    const selectionSnapshot = getSelectionSnapshot();

    if (chore.is_repeating) {
      setTitleTypeSaveBehavior(null);
      setScopePopupMode("titleType");
      return;
    }

    void enqueueSave(() =>
      onSaveTitleTypeChanges({
        chore,
        scope: "all",
        title: titleDraft,
        type: value,
      }),
    ).then((result) => {
      if (!isSelectionStillCurrent(selectionSnapshot)) {
        return;
      }

      if (result.error) {
        setSaveError(result.error);
      }
    });
  };

  const handleRepeatChange = (value: PreviewRepeatValue) => {
    const nextRepeatEndMode = value === "none" ? "never" : repeatEndMode;
    const nextRepeatEnd = repeatEnd || endDate;
    setRepeat(value);
    setRepeatEndMode(nextRepeatEndMode);
    setRepeatEnd(nextRepeatEnd);
    queueRepeatSave(value, nextRepeatEndMode, nextRepeatEnd);
  };

  const handleRepeatEndModeChange = (value: PreviewRepeatEndMode) => {
    const nextRepeatEnd =
      value === "on_date"
        ? repeatEndMode === "on_date"
          ? repeatEnd
          : getDefaultPreviewRepeatEndDate(startDate)
        : repeatEnd;
    setRepeatEndMode(value);
    setRepeatEnd(nextRepeatEnd);
    setSaveError(null);

    if (value === "on_date") {
      return;
    }

    queueRepeatSave(repeat, value, nextRepeatEnd);
  };

  const handleRepeatEndDateChange = (value: string) => {
    if (!value) {
      return;
    }

    setRepeatEnd(value);
    queueRepeatSave(repeat, repeatEndMode, value);
  };

  return (
    <>
      <div
        aria-label="Chore preview"
        className="fixed z-30 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_16px_36px_-24px_rgba(23,32,72,0.42)]"
        onMouseDownCapture={(event) => {
          if (
            isEditingTitle &&
            titleEditorRef.current &&
            !titleEditorRef.current.contains(event.target as Node)
          ) {
            const nextBehavior = getSaveBehaviorForTarget(event.target);
            pendingTitleBlurBehaviorRef.current = nextBehavior;

            if (nextBehavior.postAction !== "none") {
              suppressNextFooterActionRef.current = nextBehavior.postAction;
            }

            return;
          }

          if (
            isEditingNotes &&
            notesEditorRef.current &&
            !notesEditorRef.current.contains(event.target as Node)
          ) {
            const nextBehavior = getSaveBehaviorForTarget(event.target);
            pendingNotesBlurBehaviorRef.current = nextBehavior;

            if (nextBehavior.postAction !== "none") {
              suppressNextFooterActionRef.current = nextBehavior.postAction;
            }

            return;
          }

          if (
            hasPendingRepeatSettings &&
            repeatEditorRef.current &&
            !repeatEditorRef.current.contains(event.target as Node)
          ) {
            const nextBehavior = getSaveBehaviorForTarget(event.target);

            if (nextBehavior.postAction !== "none") {
              suppressNextFooterActionRef.current = nextBehavior.postAction;
            }

            event.preventDefault();
            event.stopPropagation();
            flushPendingRepeatSettings(nextBehavior);
            return;
          }

          if (!isExpanded) {
            return;
          }

          if (editPaneRef.current?.contains(event.target as Node)) {
            return;
          }

          collapseToViewPane();
        }}
        ref={popoverRef}
        role="dialog"
        style={{ left, top, width: popoverWidth }}
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className={`absolute h-4 w-4 rotate-45 rounded-[3px] border-[var(--stroke)] bg-[var(--surface)] ${prefersAbove ? "-bottom-2 border-b border-r" : "-top-2 border-l border-t"}`}
          style={{ left: notchLeft }}
        />
        <div className="border-b border-[var(--stroke-soft)] px-4 pb-3 pt-3">
          <div ref={titleEditorRef}>
            {canManageChores && isEditingTitle ? (
              <input
                className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold leading-tight text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:shadow-[0_0_0_1px_var(--accent)]"
                disabled={isInteractionLocked}
                onBlur={(event) => {
                  if (discardOnBlurRef.current) {
                    discardOnBlurRef.current = false;
                    return;
                  }

                  const nextBehavior =
                    pendingTitleBlurBehaviorRef.current ??
                    getSaveBehaviorForTarget(event.relatedTarget);

                  pendingTitleBlurBehaviorRef.current = null;
                  void commitTitleChanges(nextBehavior);
                }}
                onChange={(event) => setTitleDraft(event.target.value)}
                onFocus={() => setIsEditingTitle(true)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  pendingTitleBlurBehaviorRef.current = {
                    closeAfter: false,
                    collapseAfter: false,
                    postAction: "none",
                  };
                  event.currentTarget.blur();
                }}
                placeholder="Chore title"
                ref={titleInputRef}
                value={titleDraft}
              />
            ) : canManageChores ? (
              <button
                className={`block w-full rounded-md px-2 py-1 text-left text-base font-semibold leading-tight transition hover:bg-[var(--surface-strong)]/30 ${
                  trimmedTitleDraft ? "text-[var(--ink)]" : "italic text-[var(--muted)]/70"
                }`}
                disabled={isInteractionLocked}
                onClick={() => {
                  setIsEditingTitle(true);
                  setSaveError(null);
                }}
                type="button"
              >
                <span className="block truncate">{trimmedTitleDraft || "Add title"}</span>
              </button>
            ) : (
              <div className="block w-full rounded-md px-2 py-1 text-left text-base font-semibold leading-tight text-[var(--ink)]">
                <span className="block truncate">{trimmedTitleDraft || "Untitled chore"}</span>
              </div>
            )}
          </div>
        </div>
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            showExpandedEditor ? "max-h-0 opacity-0" : "max-h-28 opacity-100"
          }`}
        >
          {canManageChores ? (
            <button
              aria-expanded={showExpandedEditor}
              className="block w-full px-4 pb-3 pt-3 text-left transition hover:bg-[var(--surface-strong)]/25"
              onClick={() => setIsExpanded(true)}
              type="button"
            >
              <div className="min-w-0">
                <div className="text-[0.82rem] font-semibold leading-tight text-[var(--muted)]">
                  {getChorePreviewDateLabel(chore)}
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-strong)]/45 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    <StateIcon chore={chore} className="h-3 w-3" />
                    {statusLabel}
                  </span>
                </div>
                {repeatLabel ? (
                  <div className="pt-1.5">
                    <span className="inline-flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70"
                      />
                      {repeatLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          ) : (
            <div className="px-4 pb-3 pt-3 text-left">
              <div className="min-w-0">
                <div className="text-[0.82rem] font-semibold leading-tight text-[var(--muted)]">
                  {getChorePreviewDateLabel(chore)}
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-strong)]/45 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    <StateIcon chore={chore} className="h-3 w-3" />
                    {statusLabel}
                  </span>
                </div>
                {repeatLabel ? (
                  <div className="pt-1.5">
                    <span className="inline-flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70"
                      />
                      {repeatLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {canManageChores ? (
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${
              showExpandedEditor ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
            }`}
            ref={editPaneRef}
          >
            <div className="space-y-3 bg-[var(--surface-strong)]/35 px-4 py-3">
              <div className="space-y-1.5 text-sm leading-tight text-[var(--ink)]">
                <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                  <span className="text-right text-[var(--muted)]">status:</span>
                  <span className="inline-flex items-center gap-1 text-[0.88rem] font-medium text-[var(--ink)]">
                    <StateIcon chore={chore} className="h-3.5 w-3.5" />
                    {statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                  <span className="text-right text-[var(--muted)]">type:</span>
                  <InlineSelectField disabled={isInteractionLocked}>
                    <select
                      aria-label="Chore type"
                      className="bg-transparent px-2 py-0.5 text-[0.88rem] font-medium text-[var(--ink)] outline-none"
                      disabled={isInteractionLocked}
                      onChange={(event) => handleTypeChange(event.target.value as ChoreType)}
                      value={type}
                    >
                      <option value="close_on_done">Close when done</option>
                      <option value="stay_open">Stay open</option>
                    </select>
                  </InlineSelectField>
                </div>
                <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                  <span className="text-right text-[var(--muted)]">starts:</span>
                  <InlineDateField
                    disabled={isDateInteractionLocked}
                    onChange={handleStartDateChange}
                    value={startDate}
                  />
                </div>
                <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                  <span className="text-right text-[var(--muted)]">ends:</span>
                  <InlineDateField
                    disabled={isDateInteractionLocked}
                    min={startDate}
                    onChange={handleEndDateChange}
                    value={endDate}
                  />
                </div>
                <div className="space-y-1.5" ref={repeatEditorRef}>
                  <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                    <span className="text-right text-[var(--muted)]">repeat:</span>
                    <InlineSelectField disabled={isInteractionLocked}>
                      <select
                        className="bg-transparent px-2 py-0.5 text-[0.88rem] font-medium text-[var(--ink)] outline-none"
                        disabled={isInteractionLocked}
                        onChange={(event) =>
                          handleRepeatChange(event.target.value as PreviewRepeatValue)
                        }
                        value={repeat}
                      >
                        <option value="none">Does not repeat</option>
                        <option value="daily">Every day</option>
                        <option value="weekly">Every week</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Every month</option>
                        <option value="yearly">Every year</option>
                      </select>
                    </InlineSelectField>
                  </div>
                  {repeat !== "none" ? (
                    <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                      <span className="text-right text-[var(--muted)]">ends:</span>
                      <div className="flex items-center gap-2.5">
                        <InlineSelectField disabled={isInteractionLocked}>
                          <select
                            className="bg-transparent px-2 py-0.5 text-[0.88rem] font-medium text-[var(--ink)] outline-none"
                            disabled={isInteractionLocked}
                            onChange={(event) =>
                              handleRepeatEndModeChange(event.target.value as PreviewRepeatEndMode)
                            }
                            value={repeatEndMode}
                          >
                            <option value="never">Never</option>
                            <option value="on_date">On date</option>
                          </select>
                        </InlineSelectField>
                        {repeatEndMode === "on_date" ? (
                          <InlineDateField
                            disabled={isInteractionLocked}
                            min={startDate}
                            onChange={handleRepeatEndDateChange}
                            value={repeatEnd}
                          />
                        ) : (
                          <span className="text-[0.88rem] font-medium text-[var(--ink)]">
                            {getChorePreviewRepeatEndLabelFromState({
                              repeat,
                              repeatEndMode,
                              repeatEnd,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {saveError ? (
          <div className="border-t border-[var(--stroke-soft)] px-4 py-3">
            <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--danger-ink)]">
              {saveError}
            </div>
          </div>
        ) : null}
        <div className="border-t border-[var(--stroke-soft)] px-4 py-3" ref={notesEditorRef}>
          {canManageChores && isEditingNotes ? (
            <textarea
              className="min-h-[90px] w-full resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm leading-snug text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
              disabled={isInteractionLocked}
              onBlur={(event) => {
                if (discardOnBlurRef.current) {
                  discardOnBlurRef.current = false;
                  return;
                }

                const nextBehavior =
                  pendingNotesBlurBehaviorRef.current ??
                  getSaveBehaviorForTarget(event.relatedTarget);

                pendingNotesBlurBehaviorRef.current = null;
                void commitNotesChanges(nextBehavior);
              }}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder="Add Notes"
              ref={notesInputRef}
              value={notesDraft}
            />
          ) : canManageChores ? (
            <button
              className={`block w-full rounded-xl whitespace-pre-wrap text-left text-sm leading-snug transition hover:bg-[var(--surface-strong)]/30 ${
                trimmedNotesDraft
                  ? "px-0 text-[var(--muted)]"
                  : "px-0 italic text-[var(--muted)]/70"
              }`}
              disabled={isInteractionLocked}
              onClick={() => {
                setIsEditingNotes(true);
                setSaveError(null);
              }}
              type="button"
            >
              {trimmedNotesDraft || "Add Notes"}
            </button>
          ) : (
            <div
              className={`block w-full whitespace-pre-wrap text-left text-sm leading-snug ${
                trimmedNotesDraft
                  ? "px-0 text-[var(--muted)]"
                  : "px-0 italic text-[var(--muted)]/70"
              }`}
            >
              {trimmedNotesDraft || "No notes"}
            </div>
          )}
        </div>
        <div
          className="flex items-center justify-between gap-3 border-t border-[var(--stroke-soft)] px-4 py-2.5"
          data-preview-footer="true"
        >
          <button
            className="min-w-0 flex-1 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={primaryActionButtonDisabled}
            onClick={() => {
              onPrimaryAction(chore);
              closePreviewIfSelectionMatches();
            }}
            data-preview-post-action="close"
            type="button"
          >
            {getPrimaryActionLabel(chore)}
          </button>
          {canManageChores ? (
            <button
              aria-label="Delete chore"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--danger-stroke)] text-[var(--danger-ink)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-60"
              data-preview-post-action="delete"
              disabled={isInteractionLocked}
              onClick={() => {
                if (suppressNextFooterActionRef.current === "delete") {
                  suppressNextFooterActionRef.current = null;
                  return;
                }

                beginDeleteFlow();
              }}
              type="button"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      {scopePopupMode ? (
        <div
          className="fixed z-40 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-4 shadow-[0_22px_38px_-24px_rgba(23,32,72,0.52)]"
          ref={scopePopupRef}
          style={{ left: scopePopupLeft, top: scopePopupTop, width: scopePopupWidth }}
        >
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {scopePopupMode === "date"
              ? "Apply date changes"
              : scopePopupMode === "titleType"
                ? "Apply title or type changes"
                : scopePopupMode === "notes"
                  ? "Apply notes changes"
                  : scopePopupMode === "delete"
                    ? "Delete chore"
                    : "Apply repeat changes"}
          </div>
          <p className="mt-1 text-sm leading-snug text-[var(--ink)]">
            {scopePopupMode === "date"
              ? "Choose which chores should move to the new dates."
              : scopePopupMode === "titleType"
                ? "Choose which chores should use the new title or type."
                : scopePopupMode === "notes"
                  ? "Choose which chores should use the new notes."
                  : scopePopupMode === "delete"
                    ? deleteTarget.isFirstInSeries
                      ? "Choose whether to delete only this chore or all chores in the series."
                      : "Choose whether to delete only this chore or all future chores in the series."
                    : "Choose which chores should use the new repeat settings. Choosing only the current chore makes this occurrence a one-off."}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {scopeOptions.map((option) => (
              <button
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface-weak)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                key={option.scope}
                onClick={() => {
                  void (scopePopupMode === "date"
                    ? submitDateChanges(option.scope)
                    : scopePopupMode === "titleType"
                      ? submitTitleTypeChanges(option.scope)
                      : scopePopupMode === "notes"
                        ? submitNotesChanges(option.scope)
                        : scopePopupMode === "delete"
                          ? submitDeleteChore(option.scope as CancelChoreScope)
                          : submitRepeatChanges(option.scope));
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
            <button
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={() => {
                const shouldClose = scopePopupMode === "notes" && notesSaveBehavior?.closeAfter;
                const shouldCollapse =
                  (scopePopupMode === "notes" && notesSaveBehavior?.collapseAfter) ||
                  (scopePopupMode === "titleType" && titleTypeSaveBehavior?.collapseAfter) ||
                  (scopePopupMode === "repeat" && repeatSaveBehavior?.collapseAfter);
                const shouldCloseAfterReset =
                  shouldClose ||
                  (scopePopupMode === "titleType" && titleTypeSaveBehavior?.closeAfter) ||
                  (scopePopupMode === "repeat" && repeatSaveBehavior?.closeAfter);

                resetPreviewFields();

                if (shouldCollapse) {
                  setIsExpanded(false);
                }

                if (shouldCloseAfterReset) {
                  closePreview();
                }
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
