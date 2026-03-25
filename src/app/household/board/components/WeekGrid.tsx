import type { DateTime } from "luxon";
import { useMemo } from "react";

import DayColumn from "@/app/household/board/components/DayColumn";
import MultiDayChoreLanes from "@/app/household/board/components/MultiDayChoreLanes";
import { buildWeekGridLayout } from "@/app/household/board/multi-day-chore-layout";
import type { ChoreItem } from "@/app/household/board/types";

type WeekGridProps = {
  canManageChores: boolean;
  rangeLabel: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  days: DateTime[];
  chores: ChoreItem[];
  loading: boolean;
  today: DateTime;
  onPreviewChore: (chore: ChoreItem, anchorElement: HTMLElement) => void;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function WeekGrid({
  canManageChores,
  rangeLabel,
  onPreviousWeek,
  onNextWeek,
  onResetWeek,
  days,
  chores,
  loading,
  today,
  onPreviewChore,
  onAddChoreForDate,
}: WeekGridProps) {
  const todayKey = today.toISODate() ?? "";
  const { choreLanes, occupiedDayKeys } = useMemo(
    () => buildWeekGridLayout({ chores, days, todayKey }),
    [chores, days, todayKey],
  );

  return (
    <div className="overflow-hidden rounded-[1.05rem] border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_86%,white_14%)] p-3 shadow-[var(--shadow)] sm:p-4">
      <div className="overflow-hidden border border-[var(--stroke-soft)] bg-[var(--card)]">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-secondary-soft)_70%,white_30%),color-mix(in_srgb,var(--surface)_82%,white_18%))] px-4 py-4">
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent-secondary)]">
                  Weekly board
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{rangeLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous week"
                  className="rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)]"
                  onClick={onPreviousWeek}
                  type="button"
                >
                  {"<"}
                </button>
                <button
                  className="rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)]"
                  onClick={onResetWeek}
                  type="button"
                >
                  Today
                </button>
                <button
                  aria-label="Next week"
                  className="rounded-[0.75rem] border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)]"
                  onClick={onNextWeek}
                  type="button"
                >
                  {">"}
                </button>
              </div>
            </div>
            <div className="relative overflow-hidden bg-[var(--surface)]">
              <div className="pointer-events-none absolute inset-y-0 inset-x-2 grid grid-cols-7">
                {days.map((day, dayIndex) => (
                  <div
                    className={dayIndex > 0 ? "border-l border-[var(--stroke-soft)]" : ""}
                    key={`separator-${day.toISO()}`}
                  />
                ))}
              </div>
              <div className="relative z-10 grid grid-cols-7 gap-0 border-b border-[var(--stroke-soft)] bg-[color-mix(in_srgb,var(--surface)_88%,white_12%)] px-2 pb-2 pt-3">
                {days.map((day) => {
                  const dayKey = day.toISODate() ?? day.toISO() ?? "";
                  const isToday = day.hasSame(today, "day");

                  return (
                    <div
                      className="flex items-center justify-center px-1 pb-1"
                      key={`header-${dayKey}`}
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                        <span>{day.toFormat("ccc")}</span>
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center border text-xs font-semibold ${
                            isToday
                              ? "border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] text-white"
                              : "border-transparent text-[var(--ink)]"
                          }`}
                        >
                          {day.toFormat("d")}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="relative min-h-[540px]">
                <div className="pointer-events-none absolute inset-y-0 inset-x-2 grid grid-cols-7 gap-0">
                  {days.map((day, dayIndex) => {
                    const isWeekend = day.weekday >= 6;
                    return (
                      <div
                        className={`${isWeekend ? "bg-[var(--weekend-column-bg)]" : "bg-[var(--card)]"} ${dayIndex > 0 ? "border-l border-[var(--stroke-soft)]" : ""}`}
                        key={`body-${day.toISO()}`}
                      />
                    );
                  })}
                </div>
                <div className="relative px-2 pb-16 pt-2">
                  <MultiDayChoreLanes lanes={choreLanes} onPreviewChore={onPreviewChore} />
                </div>
                <div className="pointer-events-none absolute inset-y-0 inset-x-2 z-10 grid grid-cols-7 gap-0">
                  {days.map((day) => {
                    const dayKey = day.toISODate();
                    return (
                      <DayColumn
                        canManageChores={canManageChores}
                        dayKey={dayKey}
                        key={day.toISO()}
                        loading={loading}
                        showEmptyState={dayKey ? !occupiedDayKeys.has(dayKey) : false}
                        onAddChoreForDate={onAddChoreForDate}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
