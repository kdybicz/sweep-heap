"use client";

import { useState } from "react";

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
  const selectedIcon = value.trim();

  return (
    <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
      <span>Household icon</span>
      <button
        className="flex items-center justify-between rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-left text-sm font-semibold normal-case tracking-normal text-[var(--ink)] outline-none transition hover:border-[var(--accent)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          {selectedIcon || showEmptyIconPreview ? (
            <span className="text-xl leading-none">{selectedIcon || "🏡"}</span>
          ) : null}
          <span>{selectedIcon ? "Selected icon" : "Choose an icon"}</span>
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">Pick</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="border-b border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-5">
              <h3 className="text-xl font-semibold normal-case tracking-normal text-[var(--ink)]">
                Choose an icon
              </h3>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="grid grid-cols-6 gap-2">
                {householdIcons.map((icon) => (
                  <button
                    className="rounded-lg border border-[var(--stroke-soft)] bg-[var(--card)] px-2 py-2 text-xl leading-none transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
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
              <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke)] pt-4">
                <button
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  type="button"
                >
                  No icon
                </button>
                <button
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
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
    </div>
  );
}
