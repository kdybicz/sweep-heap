import AccountDropdown from "@/app/heap/components/AccountDropdown";

type WeekHeaderProps = {
  rangeLabel: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  canEditHousehold: boolean;
};

export default function WeekHeader({
  rangeLabel,
  onPreviousWeek,
  onNextWeek,
  onResetWeek,
  canEditHousehold,
}: WeekHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Week view</span>
          <h2 className="text-2xl font-semibold tracking-tight">{rangeLabel}</h2>
          <p className="text-xs text-[var(--muted)]">Week starts on Monday</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AccountDropdown canEditHousehold={canEditHousehold} />
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
      </div>
    </header>
  );
}
