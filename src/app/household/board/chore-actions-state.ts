import type { ChoreItem } from "@/app/household/board/types";

const matchesTargetChore = ({
  chore,
  choreId,
  occurrenceDate,
}: {
  chore: ChoreItem;
  choreId: number;
  occurrenceDate: string;
}) => chore.id === choreId && chore.occurrence_date === occurrenceDate;

export const findTargetChore = ({
  chores,
  choreId,
  occurrenceDate,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceDate: string;
}) => chores.find((chore) => matchesTargetChore({ chore, choreId, occurrenceDate }));

export const updateTargetChore = ({
  chores,
  choreId,
  occurrenceDate,
  map,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceDate: string;
  map: (chore: ChoreItem) => ChoreItem;
}) =>
  chores.map((chore) =>
    matchesTargetChore({ chore, choreId, occurrenceDate }) ? map(chore) : chore,
  );

export const applyOptimisticDone = ({
  chores,
  choreId,
  occurrenceDate,
  optimisticStatus,
  undoUntil,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceDate: string;
  optimisticStatus: "open" | "closed";
  undoUntil: string | null;
}) =>
  updateTargetChore({
    chores,
    choreId,
    occurrenceDate,
    map: (chore) => ({
      ...chore,
      status: optimisticStatus,
      closed_reason: "done",
      undo_until: undoUntil,
      can_undo: true,
    }),
  });

export const applyOptimisticUndo = ({
  chores,
  choreId,
  occurrenceDate,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceDate: string;
}) =>
  updateTargetChore({
    chores,
    choreId,
    occurrenceDate,
    map: (chore) => ({
      ...chore,
      status: "open",
      closed_reason: null,
      undo_until: null,
      can_undo: false,
    }),
  });

export const restoreTargetChore = ({
  chores,
  choreId,
  occurrenceDate,
  previous,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceDate: string;
  previous: ChoreItem;
}) =>
  updateTargetChore({
    chores,
    choreId,
    occurrenceDate,
    map: () => previous,
  });
