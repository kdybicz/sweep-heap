export default function HouseholdSetupLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-16">
        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <div className="h-6 w-40 animate-pulse rounded-full bg-[var(--surface-strong)]" />
          <div className="mt-4 h-10 w-3/4 animate-pulse rounded-full bg-[var(--surface-strong)]" />
          <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          <div className="mt-3 h-12 w-full animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          <div className="mt-6 h-10 w-40 animate-pulse rounded-full bg-[var(--surface-strong)]" />
        </div>
      </div>
    </main>
  );
}
