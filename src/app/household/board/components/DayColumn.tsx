type DayColumnProps = {
  dayKey: string | null;
  showEmptyState: boolean;
  loading: boolean;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function DayColumn({
  dayKey,
  showEmptyState,
  loading,
  onAddChoreForDate,
}: DayColumnProps) {
  return (
    <div className="flex h-full flex-col justify-between px-2 pb-2 pt-3">
      <div className="min-h-6 text-xs text-[var(--muted)]">
        {loading ? "Loading chores..." : showEmptyState ? "No chores scheduled" : null}
      </div>
      <button
        className="pointer-events-auto rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onAddChoreForDate(dayKey)}
        type="button"
      >
        Add chore
      </button>
    </div>
  );
}
