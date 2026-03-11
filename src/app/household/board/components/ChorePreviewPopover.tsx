import { useEffect, useRef } from "react";

import {
  getChorePreviewDateLabel,
  getChorePreviewRepeatLabel,
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

  if (!chore || !anchorRect) {
    return null;
  }

  const repeatLabel = getChorePreviewRepeatLabel(chore);
  const maxWidth = 280;
  const estimatedHeight = chore.notes ? 220 : 170;
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const left = Math.min(Math.max(anchorRect.left, 16), viewportWidth - maxWidth - 16);
  const prefersAbove = anchorRect.bottom + estimatedHeight + 16 > viewportHeight;
  const top = prefersAbove
    ? Math.max(anchorRect.top - estimatedHeight - 12, 16)
    : Math.min(anchorRect.bottom + 12, viewportHeight - estimatedHeight - 16);
  const notchLeft = Math.min(Math.max(anchorRect.left + anchorRect.width / 2 - left - 9, 22), 246);

  return (
    <div
      className="fixed z-30 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_16px_36px_-24px_rgba(23,32,72,0.42)]"
      ref={popoverRef}
      style={{ left, top }}
    >
      <div
        aria-hidden="true"
        className={`absolute h-4 w-4 rotate-45 rounded-[3px] border-[var(--stroke)] bg-[var(--surface)] ${prefersAbove ? "-bottom-2 border-b border-r" : "-top-2 border-l border-t"}`}
        style={{ left: notchLeft }}
      />
      <div className="border-b border-[var(--stroke-soft)] px-4 pb-3 pt-3">
        <h3 className="text-base font-semibold leading-tight text-[var(--ink)]">{chore.title}</h3>
      </div>
      <div className="px-4 pb-3 pt-3">
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
      </div>
      <div className="border-t border-[var(--stroke-soft)] px-4 py-3 text-sm leading-snug text-[var(--muted)]">
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
