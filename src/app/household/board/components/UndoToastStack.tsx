import { DateTime } from "luxon";

import { StateIcon } from "@/app/household/board/components/ChoreIcons";
import type { UndoToast } from "@/app/household/board/types";

type UndoToastStackProps = {
  undoToasts: UndoToast[];
  nowMs: number;
  onUndo: (choreId: number, occurrenceDate: string) => void;
};

export default function UndoToastStack({ undoToasts, nowMs, onUndo }: UndoToastStackProps) {
  if (!undoToasts.length) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 z-50 mx-auto flex max-w-md flex-col gap-3">
      {undoToasts.map((toast) => {
        const remainingMs = Math.max(0, DateTime.fromISO(toast.undoUntil).toMillis() - nowMs);
        const progress = Math.min(100, (remainingMs / 5000) * 100);
        return (
          <div
            key={`${toast.choreId}-${toast.occurrenceDate}`}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-xs font-semibold text-[var(--ink)] shadow-[var(--shadow)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                  <StateIcon
                    chore={{
                      type: toast.type,
                      status: "open",
                      closed_reason: "done",
                    }}
                    className="h-3 w-3"
                  />
                  {toast.type === "stay_open" ? "Logged completion" : "Marked done"}
                </span>
                <span>{toast.title}</span>
              </div>
              <button
                className="rounded-full border border-[var(--stroke)] px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                onClick={() => onUndo(toast.choreId, toast.occurrenceDate)}
                type="button"
              >
                Undo
              </button>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
