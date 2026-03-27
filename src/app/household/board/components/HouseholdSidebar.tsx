import type { DateTime } from "luxon";
import { StateIcon } from "@/app/household/board/components/ChoreIcons";
import type { ChoreItem } from "@/app/household/board/types";
import { getChoreStateLabel, isChoreCompleted } from "@/lib/chore-ui-state";

type HouseholdSidebarProps = {
  doneChores: number;
  totalChores: number;
  openChores: number;
  progress: number;
  today: DateTime;
  loadingToday: boolean;
  todayChores: ChoreItem[];
};

const getTodaySidebarChores = (todayChores: ChoreItem[]) => {
  const seen = new Set<string>();

  return todayChores.filter((chore) => {
    const key = `${chore.id}:${chore.occurrence_start_date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export default function HouseholdSidebar({
  doneChores,
  totalChores,
  openChores,
  progress,
  today,
  loadingToday,
  todayChores,
}: HouseholdSidebarProps) {
  const sidebarTodayChores = getTodaySidebarChores(todayChores);

  return (
    <aside className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_84%,white_16%)] p-5 shadow-[var(--shadow)]">
        <div className="-mx-5 -mt-5 h-2 bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-tertiary))]" />
        <div className="flex items-start gap-4">
          <div>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-secondary)]">
              The Sweep Heap
            </span>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Weekly board
            </h1>
          </div>
        </div>
        <p className="text-sm leading-7 text-[var(--muted)]">
          See the week, track what is open today, and keep the household moving without extra noise.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Week progress</span>
          <span className="text-xs text-[var(--muted)]">
            {doneChores}/{totalChores} done
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-strong)]">
          <div
            className="h-full rounded-[var(--radius-full)] bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-tertiary))] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
            <div className="font-display text-lg font-semibold">{totalChores}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
              Total
            </div>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--accent-gold-soft)] px-2 py-3">
            <div className="font-display text-lg font-semibold">{openChores}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
              Open
            </div>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--accent-tertiary-soft)] px-2 py-3">
            <div className="font-display text-lg font-semibold">{progress}%</div>
            <div className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
              Done
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Today</span>
          <span className="text-xs text-[var(--muted)]">{today.toFormat("ccc, LLL d")}</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {loadingToday ? (
            <div className="text-xs text-[var(--muted)]">Loading chores...</div>
          ) : sidebarTodayChores.length ? (
            <>
              {sidebarTodayChores.slice(0, 3).map((chore) => (
                <div
                  key={`${chore.id}-${chore.occurrence_start_date}-${chore.occurrence_date}-today`}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
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
                    <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <StateIcon className="h-3 w-3" chore={chore} />
                        {getChoreStateLabel(chore)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {sidebarTodayChores.length > 3 ? (
                <div className="text-xs text-[var(--muted)]">
                  +{sidebarTodayChores.length - 3} more today
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
