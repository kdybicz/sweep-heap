import { redirect } from "next/navigation";
import HouseholdSelectionList from "@/app/household/select/HouseholdSelectionList";
import { requirePageSessionUser } from "@/lib/page-access";
import { listActiveHouseholdsForUser } from "@/lib/repositories";
import { resolveActiveHousehold } from "@/lib/services";

export default async function HouseholdSelectPage() {
  const access = await requirePageSessionUser();
  const activeHousehold = await resolveActiveHousehold({
    sessionActiveHouseholdId: access.sessionActiveHouseholdId,
    userId: access.userId,
  });

  if (activeHousehold.status === "none") {
    redirect("/household/setup");
  }

  const households =
    activeHousehold.status === "selection-required"
      ? activeHousehold.households
      : await listActiveHouseholdsForUser(access.userId);

  if (households.length < 2) {
    redirect(households.length === 0 ? "/household/setup" : "/household");
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Households</div>
          <h1 className="text-3xl font-semibold">Choose your household</h1>
          <p className="text-sm text-[var(--muted)]">
            Select the household you want to work in. You can switch again later.
          </p>
        </header>

        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
          <HouseholdSelectionList households={households} />
        </div>
      </div>
    </main>
  );
}
