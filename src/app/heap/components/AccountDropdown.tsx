import Link from "next/link";

import { getAccountShortcuts } from "@/lib/account-menu";

type AccountDropdownProps = {
  canEditHousehold: boolean;
};

const triggerClassName =
  "flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] [&::-webkit-details-marker]:hidden";

const itemClassName =
  "block rounded-md px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-strong)]";

export default function AccountDropdown({ canEditHousehold }: AccountDropdownProps) {
  const shortcuts = getAccountShortcuts(canEditHousehold);

  return (
    <details className="relative">
      <summary className={triggerClassName}>
        Account
        <span aria-hidden className="text-[0.6rem] tracking-normal opacity-70">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] py-1 shadow-[var(--shadow-soft)]">
        {shortcuts.map((shortcut) => (
          <Link className={itemClassName} href={shortcut.href} key={shortcut.href}>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
