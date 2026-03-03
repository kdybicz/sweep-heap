import type { DateTime } from "luxon";
import { useMemo } from "react";

import DayColumn from "@/app/household/board/components/DayColumn";
import type { ChoreItem } from "@/app/household/board/types";

type WeekGridProps = {
  rangeLabel: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  days: DateTime[];
  chores: ChoreItem[];
  loading: boolean;
  today: DateTime;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function WeekGrid({
  rangeLabel,
  onPreviousWeek,
  onNextWeek,
  onResetWeek,
  days,
  chores,
  loading,
  today,
  onSelectChore,
  onAddChoreForDate,
}: WeekGridProps) {
  const choresByDay = useMemo(() => {
    const grouped = new Map<string, ChoreItem[]>();
    for (const chore of chores) {
      const dayChores = grouped.get(chore.occurrence_date);
      if (dayChores) {
        dayChores.push(chore);
      } else {
        grouped.set(chore.occurrence_date, [chore]);
      }
    }
    return grouped;
  }, [chores]);

  return (
    <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="overflow-hidden rounded-2xl bg-[var(--card)]">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] px-3 pb-3 pt-0">
              <h2 className="text-2xl font-semibold tracking-tight">{rangeLabel}</h2>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous week"
                  className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  onClick={onPreviousWeek}
                  type="button"
                >
                  {"<"}
                </button>
                <button
                  className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  onClick={onResetWeek}
                  type="button"
                >
                  Today
                </button>
                <button
                  aria-label="Next week"
                  className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  onClick={onNextWeek}
                  type="button"
                >
                  {">"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0 bg-[var(--surface)]">
              {days.map((day, dayIndex) => {
                const dayKey = day.toISODate();
                const dayChores = dayKey ? (choresByDay.get(dayKey) ?? []) : [];
                return (
                  <DayColumn
                    day={day}
                    dayChores={dayChores}
                    dayKey={dayKey}
                    key={day.toISO()}
                    loading={loading}
                    showLeftDivider={dayIndex > 0}
                    onAddChoreForDate={onAddChoreForDate}
                    onSelectChore={onSelectChore}
                    today={today}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
