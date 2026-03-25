"use client";

import Link from "next/link";

import {
  DETAILS_DROPDOWN_GROUP_ATTRIBUTE,
  useDetailsDropdown,
} from "@/app/household/board/components/useDetailsDropdown";
import { getHouseholdShortcuts } from "@/lib/household-menu";

type HouseholdDropdownProps = {
  canEditHousehold: boolean;
  canSwitchHouseholds: boolean;
  dropdownGroupName: string;
  householdIcon: string;
  householdName: string;
};

const triggerClassName =
  "inline-flex max-w-full cursor-pointer list-none items-center gap-2 rounded-[0.85rem] border border-[var(--stroke-soft)] bg-[var(--surface)] px-2.5 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-weak)] [&::-webkit-details-marker]:hidden";

const itemClassName =
  "block rounded-[0.65rem] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-strong)]";

export default function HouseholdDropdown({
  canEditHousehold,
  canSwitchHouseholds,
  dropdownGroupName,
  householdIcon,
  householdName,
}: HouseholdDropdownProps) {
  const detailsRef = useDetailsDropdown();
  const shortcuts = getHouseholdShortcuts(canEditHousehold, canSwitchHouseholds);
  const title = householdName.trim() || "Your household";
  const icon = householdIcon.trim();
  const detailsGroupProps = { [DETAILS_DROPDOWN_GROUP_ATTRIBUTE]: dropdownGroupName };

  return (
    <details
      {...detailsGroupProps}
      className="relative z-40 inline-block max-w-full"
      ref={detailsRef}
    >
      <summary className={triggerClassName}>
        <span className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="text-base leading-none" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="max-w-[min(24rem,calc(100vw-11rem))] truncate text-sm font-semibold leading-tight tracking-tight sm:text-base">
              {title}
            </span>
            <span className="inline-flex shrink-0 translate-y-px items-center border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--muted)]">
              {canEditHousehold ? "Admin" : "Member"}
            </span>
          </span>
        </span>
        <span aria-hidden className="text-[0.55rem] tracking-normal text-[var(--muted)]">
          ▾
        </span>
      </summary>

      <div className="absolute left-0 z-50 mt-2 min-w-56 max-w-[min(20rem,calc(100vw-2rem))] rounded-[0.9rem] border border-[var(--stroke)] bg-[var(--surface)] py-1 shadow-[var(--shadow-soft)]">
        <div className="border-b border-[var(--stroke-soft)] px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="text-base leading-none" aria-hidden>
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">{title}</div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Current household
              </div>
            </div>
          </div>
        </div>
        <div className="p-1">
          {shortcuts.map((shortcut) => (
            <Link className={itemClassName} href={shortcut.href} key={shortcut.href}>
              {shortcut.label}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
