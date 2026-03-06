"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { getAccountShortcuts } from "@/lib/account-menu";

type AccountDropdownProps = {
  canEditHousehold: boolean;
  userName: string;
};

const getInitials = (value: string) => {
  const pieces = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!pieces.length) {
    return "Y";
  }

  return pieces.map((piece) => piece[0]?.toUpperCase() ?? "").join("");
};

const triggerClassName =
  "flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--card)] px-2 py-1 pr-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] [&::-webkit-details-marker]:hidden";

const itemClassName =
  "block rounded-md px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-strong)]";

export default function AccountDropdown({ canEditHousehold, userName }: AccountDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const shortcuts = getAccountShortcuts(canEditHousehold);
  const label = userName.trim() || "You";
  const initials = getInitials(label);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const detailsElement = detailsRef.current;

      if (!detailsElement?.open) {
        return;
      }

      if (event.target instanceof Node && detailsElement.contains(event.target)) {
        return;
      }

      detailsElement.open = false;
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <details className="relative" ref={detailsRef}>
      <summary className={triggerClassName}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] text-[0.62rem] font-bold uppercase tracking-[0.08em]">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-semibold normal-case tracking-normal text-[var(--muted)] lg:inline">
          {label}
        </span>
        <span aria-hidden className="text-[0.55rem] tracking-normal opacity-70">
          ▾
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] py-1 shadow-[var(--shadow-soft)]">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          {label}
        </div>
        {shortcuts.map((shortcut) => (
          <Link className={itemClassName} href={shortcut.href} key={shortcut.href}>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
