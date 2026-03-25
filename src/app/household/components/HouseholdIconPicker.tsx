"use client";

import { useId, useRef, useState } from "react";
import {
  AppFormField,
  appInputButtonClass,
  appSecondaryButtonClass,
} from "@/app/components/AppFormPrimitives";
import { useDialogFocusTrap } from "@/lib/use-dialog-focus-trap";

const householdIcons = [
  "🏡",
  "🏠",
  "🧹",
  "🧺",
  "🛁",
  "🛋️",
  "🪴",
  "🌿",
  "🌞",
  "🌙",
  "⭐",
  "❤️",
  "🐶",
  "🐱",
  "🦊",
  "🦉",
  "🐝",
  "🍋",
  "🍓",
  "☕",
  "🍳",
  "🍞",
  "🧁",
  "🎈",
];

type HouseholdIconPickerProps = {
  value: string;
  onChange: (nextIcon: string) => void;
  showEmptyIconPreview?: boolean;
};

export default function HouseholdIconPicker({
  value,
  onChange,
  showEmptyIconPreview = false,
}: HouseholdIconPickerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectedIcon = value.trim();

  useDialogFocusTrap({
    active: open,
    dialogRef,
    onEscape: () => setOpen(false),
  });

  return (
    <>
      <AppFormField
        description="Pick a simple mark for menus and the board header."
        label="Household icon"
      >
        <button className={appInputButtonClass} onClick={() => setOpen(true)} type="button">
          <span className="inline-flex items-center gap-3">
            {selectedIcon || showEmptyIconPreview ? (
              <span className="text-xl leading-none">{selectedIcon || "🏡"}</span>
            ) : null}
            <span>{selectedIcon ? "Selected icon" : "Choose an icon"}</span>
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
            Pick
          </span>
        </button>
      </AppFormField>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            aria-label="Close icon picker dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="relative w-full max-w-md overflow-hidden rounded-[1rem] border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="border-b border-[var(--stroke-soft)] px-6 py-5">
              <h3
                className="text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]"
                id={titleId}
              >
                Choose an icon
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Keep it compact and readable at small sizes.
              </p>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="grid grid-cols-6 gap-2">
                {householdIcons.map((icon) => (
                  <button
                    className="rounded-[0.75rem] border border-[var(--stroke-soft)] bg-[var(--card)] px-2 py-2 text-xl leading-none transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface)]"
                    key={icon}
                    onClick={() => {
                      onChange(icon);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke-soft)] pt-4">
                <button
                  className={appSecondaryButtonClass}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  type="button"
                >
                  No icon
                </button>
                <button
                  className={appSecondaryButtonClass}
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
