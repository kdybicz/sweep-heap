import type { CSSProperties } from "react";

import { StateIcon } from "@/app/household/board/components/ChoreIcons";
import type { ChoreItem } from "@/app/household/board/types";
import { getChoreStateLabel, isChoreCompleted } from "@/lib/chore-ui-state";

type BoardChoreButtonProps = {
  chore: ChoreItem;
  onPreviewChore: (chore: ChoreItem, anchorElement: HTMLElement) => void;
  className?: string;
  shapeClassName?: string;
  statusExtra?: string | null;
  style?: CSSProperties;
};

const getChoreClasses = (chore: ChoreItem) => {
  const completed = isChoreCompleted(chore);
  const isClosed = chore.status === "closed";
  const isLogged = completed && chore.type === "stay_open";

  if (isLogged) {
    return "border-[var(--accent-soft)] bg-[var(--surface-strong)] text-[var(--ink)]";
  }

  if (completed || isClosed) {
    return "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--muted)]";
  }

  return "border-[var(--stroke)] bg-[var(--card)] text-[var(--ink)] hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]";
};

export default function BoardChoreButton({
  chore,
  onPreviewChore,
  className,
  shapeClassName,
  statusExtra,
  style,
}: BoardChoreButtonProps) {
  const showLineThrough = isChoreCompleted(chore) && chore.type === "close_on_done";

  return (
    <button
      className={`flex min-w-0 items-center justify-between gap-2 border px-2.5 py-2 text-left text-[0.7rem] font-semibold transition ${shapeClassName ?? "rounded-lg"} ${getChoreClasses(chore)} ${className ?? ""}`}
      data-chore-preview-date={chore.occurrence_date}
      data-chore-preview-id={chore.id}
      data-chore-preview-start={chore.occurrence_start_date}
      onClick={(event) => onPreviewChore(chore, event.currentTarget)}
      style={style}
      type="button"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className={`truncate ${showLineThrough ? "line-through" : ""}`}>{chore.title}</span>
        <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <StateIcon className="h-3 w-3" chore={chore} />
            {getChoreStateLabel(chore)}
          </span>
          {statusExtra ? <span>{statusExtra}</span> : null}
        </div>
      </div>
    </button>
  );
}
