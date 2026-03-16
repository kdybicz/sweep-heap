"use client";

import Link from "next/link";

import {
  DETAILS_DROPDOWN_GROUP_ATTRIBUTE,
  useDetailsDropdown,
} from "@/app/household/board/components/useDetailsDropdown";
import { getAccountShortcuts } from "@/lib/account-menu";

type AccountDropdownProps = {
  dropdownGroupName: string;
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
  "flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--card)] px-2 py-1 pr-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-strong)] [&::-webkit-details-marker]:hidden";

const itemClassName =
  "block rounded-md px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-strong)]";

export default function AccountDropdown({ dropdownGroupName, userName }: AccountDropdownProps) {
  const detailsRef = useDetailsDropdown();
  const shortcuts = getAccountShortcuts();
  const label = userName.trim() || "You";
  const initials = getInitials(label);
  const detailsGroupProps = { [DETAILS_DROPDOWN_GROUP_ATTRIBUTE]: dropdownGroupName };

  return (
    <details {...detailsGroupProps} className="relative" ref={detailsRef}>
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
        <div className="border-b border-[var(--stroke-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          {label}
        </div>
        {shortcuts.map((shortcut) =>
          shortcut.href === "/signout" ? (
            <form action="/signout" key={shortcut.href} method="post">
              <button className={`${itemClassName} w-full text-left`} type="submit">
                {shortcut.label}
              </button>
            </form>
          ) : (
            <Link className={itemClassName} href={shortcut.href} key={shortcut.href}>
              {shortcut.label}
            </Link>
          ),
        )}
      </div>
    </details>
  );
}
