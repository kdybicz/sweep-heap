import { redirect } from "next/navigation";
import HouseholdSetupForm from "@/app/household/setup/HouseholdSetupForm";
import { auth } from "@/auth";
import { getUserMemberships } from "@/lib/repositories";

export default async function HouseholdSetupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    redirect("/auth");
  }

  const memberships = await getUserMemberships(userId);
  if (memberships.length) {
    redirect("/household");
  }

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
      </div>
    </main>
  );
}
