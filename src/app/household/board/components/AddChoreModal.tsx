import type { FormEvent } from "react";
import { useId, useRef } from "react";

import {
  AppFormField,
  appDangerMessageClass,
  appInputClass,
  appPrimaryButtonClass,
  appSecondaryButtonClass,
} from "@/app/components/AppFormPrimitives";
import type { RepeatEndMode } from "@/app/household/board/useHouseholdChoreActions.types";
import type { ChoreType } from "@/lib/chore-ui-state";
import { useDialogFocusTrap } from "@/lib/use-dialog-focus-trap";

type AddChoreModalProps = {
  open: boolean;
  modalTitle: string;
  modalDescription: string;
  submitLabel: string;
  submitDisabled: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  newTitle: string;
  newType: ChoreType;
  newDate: string;
  newEndDate: string;
  newRepeat: string;
  newRepeatEndMode: RepeatEndMode;
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
  onRepeatEndModeChange: (value: RepeatEndMode) => void;
  onRepeatEndChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export default function AddChoreModal({
  open,
  modalTitle,
  modalDescription,
  submitLabel,
  submitDisabled,
  submitError,
  fieldErrors,
  submitting,
  newTitle,
  newType,
  newDate,
  newEndDate,
  newRepeat,
  newRepeatEndMode,
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
  onRepeatEndModeChange,
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

  const titleFieldId = `${titleId}-title`;
  const startDateFieldId = `${titleId}-start-date`;
  const endDateFieldId = `${titleId}-end-date`;
  const repeatFieldId = `${titleId}-repeat`;
  const repeatEndModeFieldId = `${titleId}-repeat-end-mode`;
  const repeatEndDateFieldId = `${titleId}-repeat-end-date`;
  const notesFieldId = `${titleId}-notes`;

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
        className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-6 py-5">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            Weekly board
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]" id={titleId}>
            {modalTitle}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{modalDescription}</p>
        </div>

        <form className="flex flex-col gap-5 px-6 py-5" onSubmit={onSubmit}>
          {submitError ? <div className={appDangerMessageClass}>{submitError}</div> : null}

          <section className="rounded-[1.5rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  Chore details
                </h4>
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Set the title and behavior that best match how this chore should appear on the
                  board.
                </p>
              </div>

              <AppFormField
                description="Keep the title short enough to scan quickly on the board."
                htmlFor={titleFieldId}
                label="Title"
              >
                <input
                  className={`${appInputClass} ${
                    fieldErrors.title ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""
                  }`}
                  id={titleFieldId}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="Laundry, dishes, vacuum"
                  required
                  value={newTitle}
                />
                {fieldErrors.title ? (
                  <span className="text-[0.75rem] font-medium text-[var(--danger-ink)]">
                    {fieldErrors.title}
                  </span>
                ) : null}
              </AppFormField>

              <div className="flex flex-col gap-2.5 text-left">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Chore type
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      newType === "close_on_done"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_14px_28px_rgba(42,91,215,0.12)]"
                        : "border-[var(--stroke-soft)] bg-[var(--surface)] hover:border-[var(--accent)]"
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
                    <div className="mt-2 text-sm leading-6 normal-case tracking-normal text-[var(--muted)]">
                      Marking done closes the task for this day.
                    </div>
                  </label>
                  <label
                    className={`cursor-pointer rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      newType === "stay_open"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_14px_28px_rgba(42,91,215,0.12)]"
                        : "border-[var(--stroke-soft)] bg-[var(--surface)] hover:border-[var(--accent)]"
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
                    <div className="mt-2 text-sm leading-6 normal-case tracking-normal text-[var(--muted)]">
                      Marking done logs progress but keeps it visible.
                    </div>
                  </label>
                </div>
                {fieldErrors.type ? (
                  <span className="text-[0.75rem] font-medium normal-case tracking-normal text-[var(--danger-ink)]">
                    {fieldErrors.type}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  Schedule
                </h4>
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Choose the date range and repeat rules that should define this chore on the weekly
                  board.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AppFormField htmlFor={startDateFieldId} label="Start date">
                  <input
                    className={`${appInputClass} ${
                      fieldErrors.startDate
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : ""
                    }`}
                    id={startDateFieldId}
                    onChange={(event) => onDateChange(event.target.value)}
                    type="date"
                    value={newDate}
                  />
                  {fieldErrors.startDate ? (
                    <span className="text-[0.75rem] font-medium text-[var(--danger-ink)]">
                      {fieldErrors.startDate}
                    </span>
                  ) : null}
                </AppFormField>

                <AppFormField htmlFor={endDateFieldId} label="End date">
                  <input
                    className={`${appInputClass} ${
                      fieldErrors.endDate
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : ""
                    }`}
                    id={endDateFieldId}
                    onChange={(event) => onEndDateChange(event.target.value)}
                    type="date"
                    value={newEndDate}
                  />
                  {fieldErrors.endDate ? (
                    <span className="text-[0.75rem] font-medium text-[var(--danger-ink)]">
                      {fieldErrors.endDate}
                    </span>
                  ) : null}
                </AppFormField>

                <AppFormField htmlFor={repeatFieldId} label="Repeat">
                  <select
                    className={`${appInputClass} ${
                      fieldErrors.repeatRule
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : ""
                    }`}
                    id={repeatFieldId}
                    onChange={(event) => onRepeatChange(event.target.value)}
                    value={newRepeat}
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  {fieldErrors.repeatRule ? (
                    <span className="text-[0.75rem] font-medium text-[var(--danger-ink)]">
                      {fieldErrors.repeatRule}
                    </span>
                  ) : null}
                </AppFormField>

                {newRepeat !== "none" ? (
                  <AppFormField htmlFor={repeatEndModeFieldId} label="Repeat ends">
                    <select
                      className={appInputClass}
                      id={repeatEndModeFieldId}
                      onChange={(event) =>
                        onRepeatEndModeChange(event.target.value as RepeatEndMode)
                      }
                      value={newRepeatEndMode}
                    >
                      <option value="never">Never</option>
                      <option value="on_date">On date</option>
                    </select>
                    {newRepeatEndMode === "on_date" ? (
                      <AppFormField
                        description="Choose the last date this repeating series should create a chore."
                        htmlFor={repeatEndDateFieldId}
                        label="End repeat on"
                      >
                        <input
                          className={`${appInputClass} ${
                            fieldErrors.repeatEnd
                              ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                              : ""
                          }`}
                          id={repeatEndDateFieldId}
                          onChange={(event) => onRepeatEndChange(event.target.value)}
                          type="date"
                          value={newRepeatEnd}
                        />
                        {fieldErrors.repeatEnd ? (
                          <span className="text-[0.75rem] font-medium text-[var(--danger-ink)]">
                            {fieldErrors.repeatEnd}
                          </span>
                        ) : null}
                      </AppFormField>
                    ) : null}
                  </AppFormField>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  Notes
                </h4>
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Add optional reminders, supplies, or preferences for whoever completes the chore.
                </p>
              </div>

              <AppFormField htmlFor={notesFieldId} label="Notes">
                <textarea
                  className={`${appInputClass} min-h-[110px] resize-none`}
                  id={notesFieldId}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Supplies, preferences, reminders"
                  value={newNotes}
                />
              </AppFormField>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--stroke-soft)] pt-1">
            <button className={appSecondaryButtonClass} onClick={onCancel} type="button">
              Cancel
            </button>
            <button
              className={appPrimaryButtonClass}
              disabled={submitting || submitDisabled}
              type="submit"
            >
              {submitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
