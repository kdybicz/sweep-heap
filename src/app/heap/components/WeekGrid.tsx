import type { DateTime } from "luxon";

import DayColumn from "@/app/heap/components/DayColumn";
import type { ChoreItem } from "@/app/heap/types";

type WeekGridProps = {
  days: DateTime[];
  chores: ChoreItem[];
  loading: boolean;
  today: DateTime;
  onSelectChore: (chore: ChoreItem) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function WeekGrid({
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
        <div className="grid min-w-[980px] grid-cols-7 gap-0 divide-x divide-[var(--stroke)] bg-[linear-gradient(180deg,_var(--grid-line)_1px,_transparent_1px)] [background-size:100%_64px]">
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
  );
}
