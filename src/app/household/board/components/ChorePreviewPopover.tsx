import { useEffect, useRef, useState } from "react";

import {
  getChorePreviewDateLabel,
  getChorePreviewFormState,
  getChorePreviewRepeatLabel,
  type PreviewRepeatEndMode,
  type PreviewRepeatValue,
} from "@/app/household/board/chore-preview";
import type { ChoreItem } from "@/app/household/board/types";

type ChorePreviewPopoverProps = {
  chore: ChoreItem | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onOpenDetails: (chore: ChoreItem) => void;
};

export default function ChorePreviewPopover({
  chore,
  anchorRect,
  onClose,
  onOpenDetails,
}: ChorePreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [repeat, setRepeat] = useState<PreviewRepeatValue>("none");
  const [repeatEndMode, setRepeatEndMode] = useState<PreviewRepeatEndMode>("never");
  const [repeatEnd, setRepeatEnd] = useState("");

  useEffect(() => {
    if (!chore) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [chore, onClose]);

  useEffect(() => {
    if (!chore) {
      return;
    }

    const nextState = getChorePreviewFormState(chore);
    setIsExpanded(false);
    setStartDate(nextState.startDate);
    setEndDate(nextState.endDate);
    setRepeat(nextState.repeat);
    setRepeatEndMode(nextState.repeatEndMode);
    setRepeatEnd(nextState.repeatEnd);
  }, [chore]);

  if (!chore || !anchorRect) {
    return null;
  }

  const repeatLabel = getChorePreviewRepeatLabel(chore);
  const preferredWidth = isExpanded ? 420 : 320;
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const popoverWidth = Math.min(preferredWidth, viewportWidth - 32);
  const estimatedHeight = isExpanded ? 330 : chore.notes ? 235 : 185;
  const left = Math.min(Math.max(anchorRect.left, 16), viewportWidth - popoverWidth - 16);
  const prefersAbove = anchorRect.bottom + estimatedHeight + 16 > viewportHeight;
  const top = prefersAbove
    ? Math.max(anchorRect.top - estimatedHeight - 12, 16)
    : Math.min(anchorRect.bottom + 12, viewportHeight - estimatedHeight - 16);
  const notchLeft = Math.min(Math.max(anchorRect.left + anchorRect.width / 2 - left - 9, 22), 246);

  return (
    <div
      className="fixed z-30 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_16px_36px_-24px_rgba(23,32,72,0.42)]"
      ref={popoverRef}
      style={{ left, top, width: popoverWidth }}
    >
      <div
        aria-hidden="true"
        className={`absolute h-4 w-4 rotate-45 rounded-[3px] border-[var(--stroke)] bg-[var(--surface)] ${prefersAbove ? "-bottom-2 border-b border-r" : "-top-2 border-l border-t"}`}
        style={{ left: notchLeft }}
      />
      <div className="border-b border-[var(--stroke-soft)] px-4 pb-3 pt-3">
        <h3 className="text-base font-semibold leading-tight text-[var(--ink)]">{chore.title}</h3>
      </div>
      <button
        className="block w-full px-4 pb-3 pt-3 text-left transition hover:bg-[var(--surface-strong)]/25"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <div className="text-[0.82rem] font-semibold leading-tight text-[var(--muted)]">
            {getChorePreviewDateLabel(chore)}
          </div>
          {repeatLabel ? (
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70"
                />
                {repeatLabel}
              </span>
            </div>
          ) : null}
        </div>
      </button>
      {isExpanded ? (
        <div className="border-t border-[var(--stroke-soft)] bg-[var(--surface-strong)]/35 px-4 py-3">
          <div className="space-y-2.5 text-sm leading-tight text-[var(--ink)]">
            <div className="grid grid-cols-[88px_1fr] items-center gap-x-4">
              <span className="text-right text-[var(--muted)]">starts:</span>
              <input
                className="w-full bg-transparent px-0 py-0 text-[0.95rem] font-semibold text-[var(--ink)] outline-none"
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </div>
            <div className="grid grid-cols-[88px_1fr] items-center gap-x-4">
              <span className="text-right text-[var(--muted)]">ends:</span>
              <input
                className="w-full bg-transparent px-0 py-0 text-[0.95rem] font-semibold text-[var(--ink)] outline-none"
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </div>
            <div className="grid grid-cols-[88px_1fr] items-center gap-x-4">
              <span className="text-right text-[var(--muted)]">repeat:</span>
              <select
                className="w-full bg-transparent px-0 py-0 text-[0.95rem] font-semibold text-[var(--ink)] outline-none"
                onChange={(event) => setRepeat(event.target.value as PreviewRepeatValue)}
                value={repeat}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
            {repeat !== "none" ? (
              <div className="grid grid-cols-[88px_1fr] items-center gap-x-4">
                <span className="text-right text-[var(--muted)]">end repeat:</span>
                <div className="flex items-center gap-4">
                  <select
                    className="bg-transparent px-0 py-0 text-[0.95rem] font-semibold text-[var(--ink)] outline-none"
                    onChange={(event) =>
                      setRepeatEndMode(event.target.value as PreviewRepeatEndMode)
                    }
                    value={repeatEndMode}
                  >
                    <option value="never">Never</option>
                    <option value="on_date">On date</option>
                  </select>
                  {repeatEndMode === "on_date" ? (
                    <input
                      className="bg-transparent px-0 py-0 text-[0.95rem] font-semibold text-[var(--ink)] outline-none"
                      onChange={(event) => setRepeatEnd(event.target.value)}
                      type="date"
                      value={repeatEnd}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={`border-t border-[var(--stroke-soft)] px-4 py-3 text-sm leading-snug ${
          chore.notes ? "text-[var(--muted)]" : "italic text-[var(--muted)]/70"
        }`}
      >
        {chore.notes ? chore.notes : "Add Notes"}
      </div>
      <div className="border-t border-[var(--stroke-soft)] px-4 py-2.5">
        <button
          className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
          onClick={() => {
            onClose();
            onOpenDetails(chore);
          }}
          type="button"
        >
          Open details
        </button>
      </div>
    </div>
  );
}
