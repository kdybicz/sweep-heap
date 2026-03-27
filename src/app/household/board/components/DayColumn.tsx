type DayColumnProps = {
  canManageChores: boolean;
  dayKey: string | null;
  showEmptyState: boolean;
  loading: boolean;
  onAddChoreForDate: (dayKey: string | null) => void;
};

export default function DayColumn({
  canManageChores,
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
      {canManageChores ? (
        <button
          className="pointer-events-auto rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--card)] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAddChoreForDate(dayKey)}
          type="button"
        >
          Add chore
        </button>
      ) : null}
    </div>
  );
}
