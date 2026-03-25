import Link from "next/link";

import AuthForm from "@/app/auth/AuthForm";
import { redirectSignedInUserToApp } from "@/lib/page-access";

const destinations = [
  {
    label: "Existing household",
    value: "Board",
    tone: "var(--accent-secondary-soft)",
  },
  {
    label: "New household",
    value: "Setup",
    tone: "var(--accent-soft)",
  },
  {
    label: "Multiple households",
    value: "Selector",
    tone: "var(--accent-tertiary-soft)",
  },
];

export default async function AuthPage() {
  await redirectSignedInUserToApp();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="ambient-drift absolute inset-0 -z-20 bg-[radial-gradient(circle_at_16%_16%,var(--glow-1),transparent_28%),radial-gradient(circle_at_84%_12%,var(--glow-2),transparent_26%),linear-gradient(180deg,var(--bg),var(--surface))]" />
      <div className="editorial-grid absolute inset-0 -z-10 opacity-35" />

      <div className="mx-auto grid w-full max-w-[1380px] gap-10 px-4 pb-14 pt-6 sm:px-6 lg:min-h-screen lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:px-8 lg:py-10">
        <section className="landing-reveal flex max-w-[28rem] flex-col gap-7">
          <Link
            className="w-fit text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[var(--muted)] transition hover:text-[var(--accent-secondary)]"
            href="/"
          >
            Back to landing
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center border border-[var(--stroke)] bg-[var(--surface-weak)] text-sm font-semibold uppercase tracking-[0.3em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.32em] text-[var(--accent-secondary)]">
                The Sweep Heap
              </div>
              <div className="text-sm font-medium text-[var(--muted)]">
                Password-free access for shared homes
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
              Magic link sign-in
            </div>
            <h1 className="max-w-[10ch] text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              Continue with email.
            </h1>
            <p className="max-w-md text-sm leading-7 text-[var(--muted)] sm:text-base">
              Enter the email address you want the secure sign-in link sent to. We handle the right
              household route after that.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {destinations.map((destination) => (
              <div
                className="border border-[var(--stroke-soft)] px-4 py-3 shadow-[var(--shadow-soft)]"
                key={destination.label}
                style={{ backgroundColor: destination.tone }}
              >
                <div className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {destination.label}
                </div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--ink)]">
                  {destination.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-reveal landing-reveal-delay-1 lg:justify-self-end">
          <div className="relative overflow-hidden border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_84%,white_16%)] p-3 shadow-[0_28px_72px_rgba(29,49,84,0.16)] sm:p-4">
            <div className="absolute inset-0 bg-[linear-gradient(150deg,transparent,rgba(255,255,255,0.2)_45%,transparent_64%)] opacity-70" />
            <div className="relative max-w-[42rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-6 sm:p-8">
              <div className="max-w-2xl border-b border-[var(--stroke-soft)] pb-5">
                <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
                  Enter your email
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Your sign-in link starts here.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                  Use the same email address you want to sign in with. We email a secure magic link
                  and take care of the next step.
                </p>
              </div>

              <div className="pt-6">
                <AuthForm />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
