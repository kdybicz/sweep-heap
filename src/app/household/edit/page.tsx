import { redirect } from "next/navigation";
import HouseholdEditForm from "@/app/household/edit/HouseholdEditForm";
import { auth } from "@/auth";
import { getActiveHouseholdSummary } from "@/lib/repositories";

export default async function HouseholdEditPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    redirect("/auth");
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    redirect("/household/setup");
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Settings</div>
          <h1 className="text-3xl font-semibold">Edit household</h1>
          <p className="text-sm text-[var(--muted)]">
            Update the household name, icon, and time zone for your choreboard.
          </p>
        </header>
        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <HouseholdEditForm
            initialIcon={household.icon ?? ""}
            initialName={household.name}
            initialTimeZone={household.timeZone}
          />
        </div>
      </div>
    </main>
  );
}
