import type { DateTime } from "luxon";
import { StateIcon } from "@/app/heap/components/ChoreIcons";
import SignOutButton from "@/app/heap/SignOutButton";
import type { ChoreItem } from "@/app/heap/types";
import { getChoreStateLabel, isChoreCompleted } from "@/lib/chore-ui-state";

type HeapSidebarProps = {
  doneChores: number;
  totalChores: number;
  openChores: number;
  progress: number;
  today: DateTime;
  loadingToday: boolean;
  todayChores: ChoreItem[];
  onResetWeek: () => void;
  onOpenAddChoreModal: () => void;
};

export default function HeapSidebar({
  doneChores,
  totalChores,
  openChores,
  progress,
  today,
  loadingToday,
  todayChores,
  onResetWeek,
  onOpenAddChoreModal,
}: HeapSidebarProps) {
  return (
    <aside className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
              The Sweep Heap
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Weekly Choreboard</h1>
          </div>
          <SignOutButton />
        </div>
        <p className="text-sm text-[var(--muted)]">
          Make the week feel lighter with a focused, all-day view.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            onClick={onResetWeek}
            type="button"
          >
            Today
          </button>
          <button
            className="rounded-full border border-[var(--stroke)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            onClick={onOpenAddChoreModal}
            type="button"
          >
            Add chore
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Week progress</span>
          <span className="text-xs text-[var(--muted)]">
            {doneChores}/{totalChores} done
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
            <div className="text-lg font-semibold">{totalChores}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
              Total
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
            <div className="text-lg font-semibold">{openChores}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
              Open
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
            <div className="text-lg font-semibold">{progress}%</div>
            <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
              Done
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Today</span>
          <span className="text-xs text-[var(--muted)]">{today.toFormat("ccc, LLL d")}</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {loadingToday ? (
            <div className="text-xs text-[var(--muted)]">Loading chores...</div>
          ) : todayChores.length ? (
            <>
              {todayChores.slice(0, 3).map((chore) => (
                <div
                  key={`${chore.id}-${chore.occurrence_date}-today`}
                  className="flex items-center justify-between rounded-xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className={
                        isChoreCompleted(chore) && chore.type === "close_on_done"
                          ? "text-[var(--muted)] line-through"
                          : ""
                      }
                    >
                      {chore.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <StateIcon className="h-3 w-3" chore={chore} />
                        {getChoreStateLabel(chore)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {todayChores.length > 3 ? (
                <div className="text-xs text-[var(--muted)]">
                  +{todayChores.length - 3} more today
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-xs text-[var(--muted)]">No chores scheduled</div>
          )}
        </div>
      </div>
    </aside>
  );
}
