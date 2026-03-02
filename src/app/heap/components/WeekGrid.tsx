import type { DateTime } from "luxon";

import DayColumn from "@/app/heap/components/DayColumn";
import type { ChoreItem } from "@/app/heap/types";

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
  return (
    <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <div className="overflow-x-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface-weak)]">
        <div className="min-w-[980px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke)] bg-[var(--surface)] px-3 py-3">
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
          <div className="grid grid-cols-7 gap-0 divide-x divide-[var(--stroke)] bg-[linear-gradient(180deg,_var(--grid-line)_1px,_transparent_1px)] [background-size:100%_64px]">
            {days.map((day) => {
              const dayKey = day.toISODate();
              const dayChores = chores.filter((chore) => chore.occurrence_date === dayKey);
              return (
                <DayColumn
                  day={day}
                  dayChores={dayChores}
                  dayKey={dayKey}
                  key={day.toISO()}
                  loading={loading}
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
  );
}
