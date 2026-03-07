import type { ChoreItem } from "@/app/household/board/types";

const matchesTargetChore = ({
  chore,
  choreId,
  occurrenceStartDate,
}: {
  chore: ChoreItem;
  choreId: number;
  occurrenceStartDate: string;
}) => chore.id === choreId && chore.occurrence_start_date === occurrenceStartDate;

const getChoreRowKey = (chore: ChoreItem) =>
  `${chore.id}:${chore.occurrence_start_date}:${chore.occurrence_date}`;

export const findTargetChores = ({
  chores,
  choreId,
  occurrenceStartDate,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceStartDate: string;
}) => chores.filter((chore) => matchesTargetChore({ chore, choreId, occurrenceStartDate }));

export const updateTargetChore = ({
  chores,
  choreId,
  occurrenceStartDate,
  map,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceStartDate: string;
  map: (chore: ChoreItem) => ChoreItem;
}) =>
  chores.map((chore) =>
    matchesTargetChore({ chore, choreId, occurrenceStartDate }) ? map(chore) : chore,
  );

export const applyOptimisticDone = ({
  chores,
  choreId,
  occurrenceStartDate,
  optimisticStatus,
  undoUntil,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceStartDate: string;
  optimisticStatus: "open" | "closed";
  undoUntil: string | null;
}) =>
  updateTargetChore({
    chores,
    choreId,
    occurrenceStartDate,
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
  occurrenceStartDate,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceStartDate: string;
}) =>
  updateTargetChore({
    chores,
    choreId,
    occurrenceStartDate,
    map: (chore) => ({
      ...chore,
      status: "open",
      closed_reason: null,
      undo_until: null,
      can_undo: false,
    }),
  });

export const restoreTargetChores = ({
  chores,
  choreId,
  occurrenceStartDate,
  previous,
}: {
  chores: ChoreItem[];
  choreId: number;
  occurrenceStartDate: string;
  previous: ChoreItem[];
}) => {
  const previousByRowKey = new Map(previous.map((chore) => [getChoreRowKey(chore), chore]));

  return chores.map((chore) => {
    if (!matchesTargetChore({ chore, choreId, occurrenceStartDate })) {
      return chore;
    }

    return previousByRowKey.get(getChoreRowKey(chore)) ?? chore;
  });
};
