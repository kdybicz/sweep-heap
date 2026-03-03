import { DateTime } from "luxon";
import { useId, useRef } from "react";

import { StateIcon, TypeIcon } from "@/app/household/board/components/ChoreIcons";
import type { ChoreItem } from "@/app/household/board/types";
import {
  getChoreStateLabel,
  getChoreTypeLabel,
  getPrimaryActionLabel,
  isPrimaryActionDisabled,
} from "@/lib/chore-ui-state";
import { useDialogFocusTrap } from "@/lib/use-dialog-focus-trap";

type ChoreDetailsModalProps = {
  chore: ChoreItem | null;
  todayKey: string;
  onClose: () => void;
  onPrimaryAction: (chore: ChoreItem) => void;
};

export default function ChoreDetailsModal({
  chore,
  todayKey,
  onClose,
  onPrimaryAction,
}: ChoreDetailsModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap({
    active: Boolean(chore),
    dialogRef,
    onEscape: onClose,
  });

  if (!chore) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Close chore details dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-5">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Chore</div>
          <h3 className="text-xl font-semibold" id={titleId}>
            {chore.title}
          </h3>
          <p className="text-xs text-[var(--muted)]">
            {DateTime.fromISO(chore.occurrence_date).toFormat("cccc, LLL d")}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            <TypeIcon className="h-3.5 w-3.5" type={chore.type} />
            {getChoreTypeLabel(chore.type)}
          </span>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold">
            <span className="text-[var(--muted)]">Status</span>
            <span className="inline-flex items-center gap-1">
              <StateIcon chore={chore} className="h-3.5 w-3.5" />
              {getChoreStateLabel(chore)}
            </span>
          </div>
          {chore.notes ? (
            <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                Notes
              </div>
              <div className="mt-2 text-sm text-[var(--ink)]">{chore.notes}</div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPrimaryActionDisabled({
                chore,
                todayKey,
              })}
              onClick={() => onPrimaryAction(chore)}
              type="button"
            >
              {getPrimaryActionLabel(chore)}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={chore.occurrence_date < todayKey}
                type="button"
              >
                Skip
              </button>
              <button
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={chore.occurrence_date < todayKey}
                type="button"
              >
                Snooze
              </button>
            </div>
            <button
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
