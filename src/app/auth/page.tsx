import Link from "next/link";

import AuthForm from "@/app/auth/AuthForm";
import { redirectSignedInUserToApp } from "@/lib/page-access";

const nextSteps = [
  "Open your existing board",
  "Set up a new household",
  "Choose between households",
];

export default async function AuthPage() {
  await redirectSignedInUserToApp();

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(42,91,215,0.14),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(110,160,255,0.12),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))]" />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-8 lg:min-h-screen lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16 lg:py-10">
        <section className="landing-reveal flex max-w-lg flex-col gap-6">
          <Link
            className="w-fit text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[var(--muted)] transition hover:text-[var(--ink)]"
            href="/"
          >
            Back to landing
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-weak)] text-sm font-semibold uppercase tracking-[0.28em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.32em] text-[var(--muted)]">
                The Sweep Heap
              </div>
              <div className="text-sm font-medium text-[var(--muted)]">
                Password-free household sign-in
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="max-w-[12ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Sign in and we will route you to the right next step.
            </h1>
            <p className="max-w-md text-sm leading-7 text-[var(--muted)] sm:text-base">
              Enter your email and we will send a secure magic link. After sign-in, you may go
              straight to your board, household setup, or household selection.
            </p>
          </div>

          <div className="border-t border-[var(--stroke-soft)] pt-5">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              From here you can
            </div>
            <div className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <div className="flex items-center gap-3" key={step}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    0{index + 1}
                  </span>
                  <span className="text-sm text-[var(--ink)]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-reveal landing-reveal-delay-1">
          <div className="mx-auto max-w-xl rounded-[2rem] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
            <div className="mb-6 space-y-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                Magic link sign-in
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                Use your email to continue.
              </h2>
              <p className="text-sm leading-7 text-[var(--muted)]">
                We only email you a secure sign-in link. No password to remember.
              </p>
            </div>

            <AuthForm />
          </div>
        </section>
      </div>
    </main>
  );
}
