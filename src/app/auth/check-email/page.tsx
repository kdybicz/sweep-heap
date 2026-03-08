import Link from "next/link";
import { redirectSignedInUserToApp } from "@/lib/page-access";

export default async function CheckEmailPage() {
  await redirectSignedInUserToApp();

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-16">
        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
            Check your inbox
          </div>
          <h1 className="mt-4 text-3xl font-semibold">Your magic link is on its way.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Open the email we just sent and tap the link to finish signing in. It expires in 24
            hours.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
              href="/auth"
            >
              Use a different email
            </Link>
            <Link
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
              href="/"
            >
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
