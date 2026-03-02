export type ChoreType = "close_on_done" | "stay_open";

export type ChoreVisualState = "completed" | "logged" | "open" | "closed";

export type ChoreStateInput = {
  type: ChoreType;
  status: string;
  closed_reason?: string | null;
};

export type ChorePrimaryActionInput = ChoreStateInput & {
  occurrence_date: string;
};

export const isChoreCompleted = (chore: { closed_reason?: string | null }) =>
  chore.closed_reason === "done";

export const getChoreTypeLabel = (type: ChoreType) =>
  type === "stay_open" ? "Stays open" : "Close on done";

export const getChoreVisualState = (chore: ChoreStateInput): ChoreVisualState => {
  if (isChoreCompleted(chore)) {
    return chore.type === "stay_open" ? "logged" : "completed";
  }
  if (chore.status === "closed") {
    return "closed";
  }
  return "open";
};

export const getChoreStateLabel = (chore: ChoreStateInput) => {
  const state = getChoreVisualState(chore);
  if (state === "logged") {
    return "Logged";
  }
  if (state === "completed") {
    return "Completed";
  }
  if (state === "closed") {
    return "Closed";
  }
  return "Open";
};

export const getPrimaryActionLabel = (chore: ChoreStateInput) => {
  if (chore.type === "stay_open") {
    return isChoreCompleted(chore) ? "Log again" : "Log completion";
  }
  return "Complete & close";
};

export const isPrimaryActionDisabled = ({
  chore,
  todayKey,
}: {
  chore: ChorePrimaryActionInput;
  todayKey: string;
}) =>
  (chore.type === "close_on_done" && isChoreCompleted(chore)) ||
  chore.status === "closed" ||
  chore.occurrence_date < todayKey;
