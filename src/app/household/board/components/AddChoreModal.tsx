import type { FormEvent } from "react";
import { useId, useRef } from "react";

import type { ChoreType } from "@/lib/chore-ui-state";
import { useDialogFocusTrap } from "@/lib/use-dialog-focus-trap";

type AddChoreModalProps = {
  open: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  newTitle: string;
  newType: ChoreType;
  newDate: string;
  newEndDate: string;
  newRepeat: string;
  newRepeatEnd: string;
  newNotes: string;
  onClose: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: ChoreType) => void;
  onDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRepeatChange: (value: string) => void;
  onRepeatEndChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export default function AddChoreModal({
  open,
  submitError,
  fieldErrors,
  submitting,
  newTitle,
  newType,
  newDate,
  newEndDate,
  newRepeat,
  newRepeatEnd,
  newNotes,
  onClose,
  onCancel,
  onSubmit,
  onTitleChange,
  onTypeChange,
  onDateChange,
  onEndDateChange,
  onRepeatChange,
  onRepeatEndChange,
  onNotesChange,
}: AddChoreModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap({
    active: open,
    dialogRef,
    onEscape: onClose,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Close add chore dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold" id={titleId}>
              Add a chore
            </h3>
            <p className="text-xs text-[var(--muted)]">Quick details now, schedule tweaks later.</p>
          </div>
        </div>
        <form className="flex flex-col gap-4 px-6 py-5" onSubmit={onSubmit}>
          {submitError ? (
            <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
              {submitError}
            </div>
          ) : null}
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Title
            <input
              className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                fieldErrors.title
                  ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                  : "border-[var(--stroke)]"
              }`}
              placeholder="Laundry, dishes, vacuum"
              required
              value={newTitle}
              onChange={(event) => onTitleChange(event.target.value)}
            />
            {fieldErrors.title ? (
              <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                {fieldErrors.title}
              </span>
            ) : null}
          </label>
          <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Chore type
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
                  newType === "close_on_done"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--stroke)] bg-[var(--card)]"
                }`}
              >
                <input
                  checked={newType === "close_on_done"}
                  className="sr-only"
                  name="chore-type"
                  onChange={() => onTypeChange("close_on_done")}
                  type="radio"
                  value="close_on_done"
                />
                <div className="text-sm font-semibold normal-case tracking-normal text-[var(--ink)]">
                  Close on done
                </div>
                <div className="mt-1 text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--muted)]">
                  Marking done closes the task for this day.
                </div>
              </label>
              <label
                className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
                  newType === "stay_open"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--stroke)] bg-[var(--card)]"
                }`}
              >
                <input
                  checked={newType === "stay_open"}
                  className="sr-only"
                  name="chore-type"
                  onChange={() => onTypeChange("stay_open")}
                  type="radio"
                  value="stay_open"
                />
                <div className="text-sm font-semibold normal-case tracking-normal text-[var(--ink)]">
                  Stays open
                </div>
                <div className="mt-1 text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--muted)]">
                  Marking done logs progress but keeps it visible.
                </div>
              </label>
            </div>
            {fieldErrors.type ? (
              <span className="text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--danger-ink)]">
                {fieldErrors.type}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Start date
              <input
                className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                  fieldErrors.startDate
                    ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                    : "border-[var(--stroke)]"
                }`}
                type="date"
                value={newDate}
                onChange={(event) => onDateChange(event.target.value)}
              />
              {fieldErrors.startDate ? (
                <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                  {fieldErrors.startDate}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              End date (exclusive)
              <input
                className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                  fieldErrors.endDate
                    ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                    : "border-[var(--stroke)]"
                }`}
                type="date"
                value={newEndDate}
                onChange={(event) => onEndDateChange(event.target.value)}
              />
              {fieldErrors.endDate ? (
                <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                  {fieldErrors.endDate}
                </span>
              ) : (
                <span className="text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--muted)]">
                  Use the next day for an all-day chore.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Repeat
              <select
                className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                  fieldErrors.repeatRule
                    ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                    : "border-[var(--stroke)]"
                }`}
                value={newRepeat}
                onChange={(event) => onRepeatChange(event.target.value)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              {fieldErrors.repeatRule ? (
                <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                  {fieldErrors.repeatRule}
                </span>
              ) : null}
            </label>
            {newRepeat !== "none" ? (
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Repeat ends
                <input
                  className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                    fieldErrors.repeatEnd
                      ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                      : "border-[var(--stroke)]"
                  }`}
                  type="date"
                  value={newRepeatEnd}
                  onChange={(event) => onRepeatEndChange(event.target.value)}
                />
                {fieldErrors.repeatEnd ? (
                  <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                    {fieldErrors.repeatEnd}
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Notes
            <textarea
              className="min-h-[90px] resize-none rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              placeholder="Supplies, preferences, reminders"
              value={newNotes}
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </label>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke)] pt-4">
            <button
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Saving..." : "Save chore"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
