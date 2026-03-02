import type { DateTime } from "luxon";

import { StateIcon } from "@/app/heap/components/ChoreIcons";
import type { ChoreItem } from "@/app/heap/types";
import { getChoreStateLabel, isChoreCompleted } from "@/lib/chore-ui-state";

type DayColumnProps = {
  day: DateTime;
  dayKey: string | null;
  dayChores: ChoreItem[];
  loading: boolean;
  today: DateTime;
  showLeftDivider: boolean;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function DayColumn({
  day,
  dayKey,
  dayChores,
  loading,
  today,
  showLeftDivider,
  onSelectChore,
  onAddChoreForDate,
}: DayColumnProps) {
  const isToday = day.hasSame(today, "day");

  return (
    <div className="group flex min-h-[480px] flex-col bg-[var(--surface)] pt-1">
      <div className="flex items-center justify-center px-1 pb-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <span>{day.toFormat("ccc")}</span>
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
              isToday ? "bg-[var(--accent)] text-white" : "text-[var(--ink)]"
            }`}
          >
            {day.toFormat("d")}
          </span>
        </span>
      </div>
      <div
        className={`mt-1 flex-1 rounded-sm bg-[var(--card)] p-2 ${
          showLeftDivider ? "border-l border-[var(--stroke-soft)]" : ""
        }`}
      >
        {loading ? (
          <div className="text-xs text-[var(--muted)]">Loading chores...</div>
        ) : dayChores.length ? (
          <div className="flex flex-col gap-1.5">
            {dayChores.map((chore) => {
              const completed = isChoreCompleted(chore);
              const isClosed = chore.status === "closed";
              const showLineThrough = completed && chore.type === "close_on_done";
              const isLogged = completed && chore.type === "stay_open";
              return (
                <button
                  key={`${chore.id}-${chore.occurrence_date}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[0.7rem] font-semibold transition ${
                    showLineThrough || isClosed
                      ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--muted)]"
                      : isLogged
                        ? "border-[var(--accent-soft)] bg-[var(--surface-strong)] text-[var(--ink)]"
                        : "border-[var(--stroke)] bg-[var(--card)] text-[var(--ink)] hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => onSelectChore(chore)}
                  type="button"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={showLineThrough ? "line-through" : ""}>{chore.title}</span>
                    <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <StateIcon className="h-3 w-3" chore={chore} />
                        {getChoreStateLabel(chore)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[var(--muted)]">No chores scheduled</div>
        )}
      </div>
      <button
        className="mx-2 mt-2 rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onAddChoreForDate(dayKey)}
        disabled={day < today}
        type="button"
      >
        Add chore
      </button>
    </div>
  );
}
