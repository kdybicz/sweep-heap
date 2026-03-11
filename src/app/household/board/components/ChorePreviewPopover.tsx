import { DateTime } from "luxon";
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
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onOpenDetails: (chore: ChoreItem) => void;
};

const formatPreviewInputDate = (value: string) => {
  const parsed = DateTime.fromISO(value, { zone: "UTC" });
  if (!parsed.isValid) {
    return value;
  }

  return parsed.toFormat("dd/MM/yyyy");
};

type InlineDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  minWidthClassName?: string;
};

function InlineDateField({
  value,
  onChange,
  minWidthClassName = "min-w-[7.75rem]",
}: InlineDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative inline-flex ${minWidthClassName} rounded-md border border-transparent transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[inset_0_0_0_1px_var(--stroke-soft)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent)]`}
    >
      <button
        className="w-full rounded-md px-2 py-0.5 text-left text-[0.88rem] font-medium text-[var(--ink)] outline-none"
        onClick={() => {
          const input = inputRef.current;
          if (!input) {
            return;
          }

          if (typeof input.showPicker === "function") {
            input.showPicker();
            return;
          }

          input.click();
        }}
        type="button"
      >
        {formatPreviewInputDate(value)}
      </button>
      <input
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />
    </div>
  );
}

export default function ChorePreviewPopover({
  chore,
  anchorElement,
  onClose,
  onOpenDetails,
}: ChorePreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [repeat, setRepeat] = useState<PreviewRepeatValue>("none");
  const [repeatEndMode, setRepeatEndMode] = useState<PreviewRepeatEndMode>("never");
  const [repeatEnd, setRepeatEnd] = useState("");

  useEffect(() => {
    if (!chore || !anchorElement) {
      setAnchorRect(null);
      return;
    }

    const updateRect = () => {
      if (!anchorElement.isConnected) {
        onClose();
        return;
      }

      setAnchorRect(anchorElement.getBoundingClientRect());
    };

    updateRect();

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [anchorElement, chore, onClose]);

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

  const currentAnchorRect = anchorRect ?? anchorElement?.getBoundingClientRect() ?? null;

  if (!chore || !currentAnchorRect) {
    return null;
  }

  const repeatLabel = getChorePreviewRepeatLabel(chore);
  const preferredWidth = isExpanded ? 360 : 320;
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const popoverWidth = Math.min(preferredWidth, viewportWidth - 32);
  const estimatedHeight = isExpanded ? 330 : chore.notes ? 235 : 185;
  const left = Math.min(Math.max(currentAnchorRect.left, 16), viewportWidth - popoverWidth - 16);
  const prefersAbove = currentAnchorRect.bottom + estimatedHeight + 16 > viewportHeight;
  const top = prefersAbove
    ? Math.max(currentAnchorRect.top - estimatedHeight - 12, 16)
    : Math.min(currentAnchorRect.bottom + 12, viewportHeight - estimatedHeight - 16);
  const notchLeft = Math.min(
    Math.max(currentAnchorRect.left + currentAnchorRect.width / 2 - left - 9, 22),
    popoverWidth - 34,
  );

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
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isExpanded ? "max-h-0 opacity-0" : "max-h-28 opacity-100"
        }`}
      >
        <button
          aria-expanded={isExpanded}
          className="block w-full px-4 pb-3 pt-3 text-left transition hover:bg-[var(--surface-strong)]/25"
          onClick={() => setIsExpanded(true)}
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
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isExpanded ? "max-h-[20rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[var(--surface-strong)]/35 px-4 py-2.5">
          <div className="space-y-1.5 text-sm leading-tight text-[var(--ink)]">
            <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
              <span className="text-right text-[var(--muted)]">starts:</span>
              <InlineDateField onChange={setStartDate} value={startDate} />
            </div>
            <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
              <span className="text-right text-[var(--muted)]">ends:</span>
              <InlineDateField onChange={setEndDate} value={endDate} />
            </div>
            <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
              <span className="text-right text-[var(--muted)]">repeat:</span>
              <div className="inline-flex rounded-md border border-transparent transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[inset_0_0_0_1px_var(--stroke-soft)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent)]">
                <select
                  className="bg-transparent px-2 py-0.5 text-[0.88rem] font-medium text-[var(--ink)] outline-none"
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
            </div>
            {repeat !== "none" ? (
              <div className="grid grid-cols-[76px_1fr] items-center gap-x-3">
                <span className="text-right text-[var(--muted)]">end repeat:</span>
                <div className="flex items-center gap-2.5">
                  <div className="inline-flex rounded-md border border-transparent transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[inset_0_0_0_1px_var(--stroke-soft)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent)]">
                    <select
                      className="bg-transparent px-2 py-0.5 text-[0.88rem] font-medium text-[var(--ink)] outline-none"
                      onChange={(event) =>
                        setRepeatEndMode(event.target.value as PreviewRepeatEndMode)
                      }
                      value={repeatEndMode}
                    >
                      <option value="never">Never</option>
                      <option value="on_date">On date</option>
                    </select>
                  </div>
                  {repeatEndMode === "on_date" ? (
                    <InlineDateField
                      minWidthClassName="min-w-[7.75rem]"
                      onChange={setRepeatEnd}
                      value={repeatEnd}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
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
