"use client";

import Link from "next/link";

export default function SignOutButton() {
  return (
    <Link
      className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
      href="/signout"
    >
      Sign out
    </Link>
  );
}
