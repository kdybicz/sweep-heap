import Link from "next/link";

import { redirectSignedInUserToApp } from "@/lib/page-access";

const inboxChecklist = [
  "Open the newest email from The Sweep Heap",
  "Tap the magic link on this device",
  "Come back here if you want to try another email",
];

export default async function CheckEmailPage() {
  await redirectSignedInUserToApp();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="ambient-drift absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,var(--glow-1),transparent_30%),radial-gradient(circle_at_80%_12%,var(--glow-2),transparent_30%),linear-gradient(180deg,var(--bg),var(--surface))]" />
      <div className="editorial-grid absolute inset-0 -z-10 opacity-35" />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-8 lg:min-h-screen lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16 lg:py-10">
        <section className="landing-reveal flex max-w-lg flex-col gap-6">
          <Link
            className="w-fit text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] transition hover:text-[var(--accent-secondary)]"
            href="/"
          >
            Back to landing
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--surface-weak)] font-display text-sm font-semibold uppercase tracking-[0.1em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--accent-secondary)]">
                The Sweep Heap
              </div>
              <div className="text-sm font-medium text-[var(--muted)]">Magic link on the way</div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="font-display max-w-[12ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Check your inbox to finish signing in.
            </h1>
            <p className="max-w-md text-sm leading-7 text-[var(--muted)] sm:text-base">
              We just sent a secure link to your email. Open it on this device to continue into your
              board, household setup, or household selection.
            </p>
          </div>

          <div className="border-t border-[var(--stroke-soft)] pt-5">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Quick checklist
            </div>
            <div className="mt-4 space-y-3">
              {inboxChecklist.map((item, index) => (
                <div className="flex items-center gap-3" key={item}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--surface)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    0{index + 1}
                  </span>
                  <span className="text-sm text-[var(--ink)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-reveal landing-reveal-delay-1">
          <div className="paper-grain mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_84%,white_16%)] p-6 shadow-[var(--shadow)] sm:p-8">
            <div className="mb-6 space-y-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                Check your inbox
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                Your magic link is on its way.
              </h2>
              <p className="text-sm leading-7 text-[var(--muted)]">
                The link expires in 24 hours. If you do not see it soon, check spam or try another
                email address.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-[var(--radius-md)] border border-transparent bg-[var(--accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(217,90,58,0.22)]"
                href="/auth"
              >
                Use a different email
              </Link>
              <Link
                className="rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-strong)]"
                href="/"
              >
                Back to landing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
