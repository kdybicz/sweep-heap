import { DateTime } from "luxon";

import { addDaysToDateKey, subtractDaysFromDateKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";
import type { EditChoreScope } from "@/app/household/board/useHouseholdChoreActions.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type PreviewRepeatValue = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export type PreviewRepeatEndMode = "never" | "on_date";

export type ChorePreviewFormState = {
  startDate: string;
  endDate: string;
  repeat: PreviewRepeatValue;
  repeatEndMode: PreviewRepeatEndMode;
  repeatEnd: string;
};

export type ChorePreviewDateChangeScopeOption = {
  scope: EditChoreScope;
  label: string;
};

export type ChorePreviewTarget = {
  choreId: number;
  occurrenceStartDate: string;
};

export type ChorePreviewSaveTrackingState = {
  sessionId: number;
  queue: Promise<unknown>;
  pendingCount: number;
};

export const createChorePreviewSaveTrackingState = (
  sessionId = 0,
): ChorePreviewSaveTrackingState => ({
  sessionId,
  queue: Promise.resolve(),
  pendingCount: 0,
});

export const resetChorePreviewSaveTrackingState = (
  state: Pick<ChorePreviewSaveTrackingState, "sessionId">,
): ChorePreviewSaveTrackingState => {
  return createChorePreviewSaveTrackingState(state.sessionId + 1);
};

export const enqueueChorePreviewSave = <T>({
  state,
  task,
}: {
  state: ChorePreviewSaveTrackingState;
  task: () => Promise<T>;
}) => {
  const sessionId = state.sessionId;
  const scheduled = state.queue.catch(() => undefined).then(() => task());

  return {
    sessionId,
    promise: scheduled,
    state: {
      sessionId,
      queue: scheduled.then(
        () => undefined,
        () => undefined,
      ),
      pendingCount: state.pendingCount + 1,
    } satisfies ChorePreviewSaveTrackingState,
  };
};

export const finishChorePreviewSave = ({
  state,
  sessionId,
}: {
  state: ChorePreviewSaveTrackingState;
  sessionId: number;
}) => {
  if (state.sessionId !== sessionId) {
    return {
      state,
      isSaving: state.pendingCount > 0,
    };
  }

  const pendingCount = Math.max(state.pendingCount - 1, 0);

  return {
    state: {
      ...state,
      pendingCount,
    },
    isSaving: pendingCount > 0,
  };
};

export const getChorePreviewMutationTarget = ({
  chore,
  targetChoreId,
  targetOccurrenceStartDate,
}: {
  chore: Pick<ChoreItem, "id" | "occurrence_start_date">;
  targetChoreId?: number;
  targetOccurrenceStartDate?: string;
}): ChorePreviewTarget | null => {
  if (!targetChoreId) {
    return null;
  }

  return {
    choreId: targetChoreId,
    occurrenceStartDate: targetOccurrenceStartDate ?? chore.occurrence_start_date,
  };
};

export const getChorePreviewDateMutationTarget = ({
  chore,
  scope,
  startDate,
  targetChoreId,
  targetOccurrenceStartDate,
}: {
  chore: Pick<ChoreItem, "id" | "is_repeating" | "occurrence_start_date">;
  scope: EditChoreScope;
  startDate: string;
  targetChoreId?: number;
  targetOccurrenceStartDate?: string;
}): ChorePreviewTarget | null => {
  if (!targetChoreId) {
    return null;
  }

  if (targetChoreId !== chore.id) {
    return {
      choreId: targetChoreId,
      occurrenceStartDate: getChorePreviewDateTargetOccurrenceStartDate({ startDate }),
    };
  }

  if (targetOccurrenceStartDate) {
    return {
      choreId: targetChoreId,
      occurrenceStartDate: targetOccurrenceStartDate,
    };
  }

  return {
    choreId: targetChoreId,
    occurrenceStartDate:
      targetChoreId !== chore.id || (!chore.is_repeating && scope === "all")
        ? startDate
        : chore.occurrence_start_date,
  };
};

export const getChorePreviewDateTargetOccurrenceStartDate = ({
  startDate,
  targetOccurrenceStartDate,
}: {
  startDate: string;
  targetOccurrenceStartDate?: string;
}) => {
  return targetOccurrenceStartDate ?? startDate;
};

export const getPreviewPopoverChore = ({
  previewChore,
  visiblePreviewChore,
  pendingPreviewTarget,
}: {
  previewChore: ChoreItem | null;
  visiblePreviewChore: ChoreItem | null;
  pendingPreviewTarget: ChorePreviewTarget | null;
}) => {
  if (visiblePreviewChore) {
    return visiblePreviewChore;
  }

  if (previewChore && pendingPreviewTarget) {
    return previewChore;
  }

  return null;
};

export const getRepeatRuleForPreviewValue = (value: PreviewRepeatValue) => {
  switch (value) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "biweekly":
      return "biweek";
    case "monthly":
      return "month";
    case "yearly":
      return "year";
    default:
      return "none";
  }
};

export const getPreviewRepeatValue = (
  repeatRule: string | null | undefined,
): PreviewRepeatValue => {
  switch (repeatRule) {
    case "day":
      return "daily";
    case "week":
      return "weekly";
    case "biweek":
      return "biweekly";
    case "month":
      return "monthly";
    case "year":
      return "yearly";
    default:
      return "none";
  }
};

export const getChorePreviewFormState = (chore: ChoreItem): ChorePreviewFormState => {
  const startDate = chore.occurrence_start_date;
  const endDate = subtractDaysFromDateKey(addDaysToDateKey(startDate, chore.duration_days ?? 1), 1);

  return {
    startDate,
    endDate,
    repeat: getPreviewRepeatValue(chore.repeat_rule),
    repeatEndMode: chore.series_end_date ? "on_date" : "never",
    repeatEnd: chore.series_end_date ?? endDate,
  };
};

export const getChorePreviewDayOffset = (chore: ChoreItem) => {
  const occurrence = DateTime.fromISO(chore.occurrence_date, { zone: "UTC" });
  const start = DateTime.fromISO(chore.occurrence_start_date, { zone: "UTC" });

  if (!occurrence.isValid || !start.isValid) {
    return 0;
  }

  return Math.round(occurrence.diff(start, "days").days);
};

export const getChorePreviewSelectionKey = (chore: ChoreItem) => {
  return `${chore.id}:${chore.is_repeating ? chore.occurrence_start_date : "single"}:${getChorePreviewDayOffset(chore)}`;
};

export const findPreviewChoreForTarget = ({
  chores,
  target,
  preferredOffset,
}: {
  chores: ChoreItem[];
  target: ChorePreviewTarget;
  preferredOffset: number;
}) => {
  const matchingChores = chores.filter(
    (chore) =>
      chore.id === target.choreId && chore.occurrence_start_date === target.occurrenceStartDate,
  );

  if (!matchingChores.length) {
    return null;
  }

  const preferredOccurrenceDate = addDaysToDateKey(target.occurrenceStartDate, preferredOffset);
  const exactMatch = matchingChores.find(
    (chore) => chore.occurrence_date === preferredOccurrenceDate,
  );

  if (exactMatch) {
    return exactMatch;
  }

  return matchingChores.reduce<ChoreItem>((best, candidate) => {
    const bestDistance = Math.abs(getChorePreviewDayOffset(best) - preferredOffset);
    const candidateDistance = Math.abs(getChorePreviewDayOffset(candidate) - preferredOffset);

    if (candidateDistance !== bestDistance) {
      return candidateDistance < bestDistance ? candidate : best;
    }

    return candidate.occurrence_date < best.occurrence_date ? candidate : best;
  }, matchingChores[0]);
};

export const areChorePreviewDatesDirty = (
  chore: ChoreItem,
  nextDates: Pick<ChorePreviewFormState, "startDate" | "endDate">,
) => {
  const original = getChorePreviewFormState(chore);

  return original.startDate !== nextDates.startDate || original.endDate !== nextDates.endDate;
};

export const areChorePreviewRepeatSettingsDirty = (
  chore: ChoreItem,
  nextSettings: Pick<ChorePreviewFormState, "repeat" | "repeatEndMode" | "repeatEnd">,
) => {
  const original = getChorePreviewFormState(chore);

  return (
    original.repeat !== nextSettings.repeat ||
    original.repeatEndMode !== nextSettings.repeatEndMode ||
    (nextSettings.repeat === "none" ? false : original.repeatEnd !== nextSettings.repeatEnd)
  );
};

export const areChorePreviewTitleTypeDirty = (
  chore: ChoreItem,
  nextTitleType: { title: string; type: ChoreType },
) => {
  return chore.title.trim() !== nextTitleType.title.trim() || chore.type !== nextTitleType.type;
};

export const isFirstChoreOccurrenceInSeries = (chore: ChoreItem) => {
  return (chore.series_start_date ?? chore.occurrence_start_date) === chore.occurrence_start_date;
};

export const getChorePreviewDateChangeScopeOptions = (
  chore: ChoreItem,
): ChorePreviewDateChangeScopeOption[] => {
  if (isFirstChoreOccurrenceInSeries(chore)) {
    return [
      { scope: "single", label: "Only current chore" },
      { scope: "all", label: "All chores" },
    ];
  }

  return [
    { scope: "single", label: "Only current chore" },
    { scope: "following", label: "All future chores" },
    { scope: "all", label: "All chores" },
  ];
};

export const getChorePreviewRepeatChangeScopeOptions = (
  chore: ChoreItem,
): ChorePreviewDateChangeScopeOption[] => {
  return getChorePreviewDateChangeScopeOptions(chore);
};

export const getChorePreviewRepeatLabelFromValue = (repeat: PreviewRepeatValue) => {
  switch (repeat) {
    case "daily":
      return "Repeats daily";
    case "weekly":
      return "Repeats weekly";
    case "biweekly":
      return "Repeats every 2 weeks";
    case "monthly":
      return "Repeats monthly";
    case "yearly":
      return "Repeats yearly";
    default:
      return null;
  }
};

export const getChorePreviewDateLabel = (chore: ChoreItem) => {
  const durationDays = chore.duration_days ?? 1;
  const occurrenceStart = DateTime.fromISO(chore.occurrence_start_date);
  const occurrenceEnd = occurrenceStart.plus({ days: durationDays - 1 });

  if (durationDays <= 1) {
    return occurrenceStart.toFormat("d LLL yyyy");
  }

  return `${occurrenceStart.toFormat("d LLL yyyy")} - ${occurrenceEnd.toFormat("d LLL yyyy")}`;
};

export const getChorePreviewRepeatLabel = (chore: ChoreItem) => {
  return getChorePreviewRepeatLabelFromValue(getPreviewRepeatValue(chore.repeat_rule));
};

export const getChorePreviewRepeatEndLabel = (chore: ChoreItem) => {
  if (!chore.series_end_date) {
    return "Never";
  }

  const parsed = DateTime.fromISO(chore.series_end_date, { zone: "UTC" });
  if (!parsed.isValid) {
    return chore.series_end_date;
  }

  return parsed.toFormat("d LLL yyyy");
};

export const getChorePreviewRepeatEndLabelFromState = ({
  repeat,
  repeatEndMode,
  repeatEnd,
}: Pick<ChorePreviewFormState, "repeat" | "repeatEndMode" | "repeatEnd">) => {
  if (repeat === "none" || repeatEndMode !== "on_date") {
    return "Never";
  }

  const parsed = DateTime.fromISO(repeatEnd, { zone: "UTC" });
  if (!parsed.isValid) {
    return repeatEnd;
  }

  return parsed.toFormat("d LLL yyyy");
};

export const getDefaultPreviewRepeatEndDate = (startDate: string) => {
  return startDate;
};
