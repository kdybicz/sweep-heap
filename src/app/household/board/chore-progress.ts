import type { ChoreItem } from "@/app/household/board/types";
import { isChoreCompleted } from "@/lib/chore-ui-state";

/** List rows represent visible days; progress counts occurrence identities. */
export const getWeeklyChoreProgress = (chores: readonly ChoreItem[]) => {
  const seen = new Set<string>();
  let doneChores = 0;
  for (const chore of chores) {
    const key = `${chore.id}:${chore.occurrence_start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isChoreCompleted(chore)) doneChores += 1;
  }
  const totalChores = seen.size;
  return {
    doneChores,
    totalChores,
    openChores: totalChores - doneChores,
    progress: totalChores ? Math.round((doneChores / totalChores) * 100) : 0,
  };
};
