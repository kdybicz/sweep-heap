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
    <div className="rounded-[1.9rem] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="overflow-hidden rounded-[1.5rem] bg-[var(--card)]">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] px-4 pb-4 pt-1">
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
            <div className="relative overflow-hidden rounded-b-2xl bg-[var(--surface)]">
              <div className="pointer-events-none absolute inset-y-0 inset-x-2 grid grid-cols-7">
                {days.map((day, dayIndex) => (
                  <div
                    className={dayIndex > 0 ? "border-l border-[var(--stroke-soft)]" : ""}
                    key={`separator-${day.toISO()}`}
                  />
                ))}
              </div>
              <div className="relative z-10 grid grid-cols-7 gap-0 border-b border-[var(--stroke-soft)] px-2 pb-2 pt-1">
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
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                            isToday ? "bg-[var(--accent)] text-white" : "text-[var(--ink)]"
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
