import Link from "next/link";

import HouseholdSetupForm from "@/app/household/setup/HouseholdSetupForm";
import { requirePageSessionUser } from "@/lib/page-access";
import { resolveActiveHousehold } from "@/lib/services/active-household-service";

export default async function HouseholdSetupPage() {
  const access = await requirePageSessionUser();
  const householdResolution = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });
  const exitAction =
    householdResolution.status === "resolved"
      ? { href: "/household", label: "Back to board" }
      : householdResolution.status === "selection-required"
        ? { href: "/household/select", label: "Back to household selection" }
        : null;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Setup</div>
          <h1 className="text-3xl font-semibold">Create your household.</h1>
          <p className="text-sm text-[var(--muted)]">
            Give your household a name, icon, and time zone to anchor weekly chores.
          </p>
        </header>
        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <HouseholdSetupForm />
        </div>

        {exitAction ? (
          <div>
            <Link
              className="inline-flex rounded-full border border-[var(--stroke)] bg-[var(--card)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
              href={exitAction.href}
            >
              {exitAction.label}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
