import Link from "next/link";

import AuthForm from "@/app/auth/AuthForm";
import { redirectSignedInUserToApp } from "@/lib/page-access";

export default async function AuthPage() {
  await redirectSignedInUserToApp();

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_80%_10%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_55%)]" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-16">
        <header className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
            Welcome back
          </div>
          <h1 className="text-3xl font-semibold">Sign in with a magic link.</h1>
          <p className="text-sm text-[var(--muted)]">
            We will email you a secure link to finish signing in.
          </p>
        </header>
        <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <AuthForm />
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          New here? Create your household after signing in.
        </div>
        <Link
          className="w-fit rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
          href="/"
        >
          Back to landing
        </Link>
      </div>
    </main>
  );
}
