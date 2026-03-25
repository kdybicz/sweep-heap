import { AppPageCard, AppPageShell } from "@/app/components/AppPageShell";

export default function HouseholdSetupLoading() {
  return (
    <AppPageShell>
      <AppPageCard>
        <div className="h-6 w-40 animate-pulse rounded-full bg-[var(--surface-strong)]" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded-full bg-[var(--surface-strong)]" />
        <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="mt-3 h-12 w-full animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="mt-6 h-10 w-40 animate-pulse rounded-full bg-[var(--surface-strong)]" />
      </AppPageCard>
    </AppPageShell>
  );
}
