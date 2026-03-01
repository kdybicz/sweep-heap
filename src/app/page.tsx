import Link from "next/link";

const highlights = [
  {
    title: "Weekly clarity",
    copy: "Organize chores into a calm, visual week board that stays focused on what matters now.",
  },
  {
    title: "Fast updates",
    copy: "Log completions in seconds with quick actions and undo windows for stress-free adjustments.",
  },
  {
    title: "Gentle nudges",
    copy: "See today's workload at a glance, with subtle progress cues that keep momentum up.",
  },
];

const steps = [
  {
    title: "Set the cadence",
    copy: "Pick a date range and let the board auto-group chores by week.",
  },
  {
    title: "Add what matters",
    copy: "Capture one-offs or repeating tasks without breaking your flow.",
  },
  {
    title: "Celebrate the sweep",
    copy: "Track completion progress and close out the week together.",
  },
];

const metrics = [
  { label: "Avg. setup time", value: "< 5 min" },
  { label: "Weekly focus", value: "7-day view" },
  { label: "Undo window", value: "5 sec" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_85%_15%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_50%)]" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pb-8 pt-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] text-sm font-semibold uppercase tracking-[0.3em] shadow-[var(--shadow-soft)]">
            SH
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
              The Sweep Heap
            </span>
            <span className="text-lg font-semibold">Chores made lighter</span>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)] md:flex">
          <a className="transition hover:text-[var(--ink)]" href="#how-it-works">
            How it works
          </a>
          <a className="transition hover:text-[var(--ink)]" href="#benefits">
            Benefits
          </a>
          <a className="transition hover:text-[var(--ink)]" href="#start">
            Get started
          </a>
        </nav>
        <Link
          className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
          href="/auth"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <div className="flex w-fit items-center gap-3 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--muted)] shadow-[var(--shadow-soft)]">
              Weekly calm
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              A tidy plan for the people who keep your space running.
            </h1>
            <p className="text-base text-[var(--muted)] md:text-lg">
              Sweep Heap turns chores into a shared ritual. Plan the week, nudge the day, and feel
              lighter with each small win.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                href="/auth"
              >
                Get started
              </Link>
              <a
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                href="#how-it-works"
              >
                See the flow
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  Today on deck
                </div>
                <div className="text-2xl font-semibold">Midweek refresh</div>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                4 tasks
              </span>
            </div>
            <div className="mt-6 grid gap-3">
              {["Kitchen reset", "Laundry cycle", "Entryway sweep", "Plants + water"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-sm font-semibold"
                  >
                    <span>{item}</span>
                    <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                      Open
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--stroke)] bg-[var(--surface-weak)] px-4 py-3 text-xs text-[var(--muted)]">
              Preview of the weekly board experience.
            </div>
          </div>
        </section>

        <section id="benefits" className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Benefit</div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="text-sm text-[var(--muted)]">{item.copy}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              How it works
            </div>
            <h2 className="mt-3 text-2xl font-semibold">A gentle rhythm for every home.</h2>
            <div className="mt-6 grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-sm font-semibold">
                    0{index + 1}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-lg font-semibold">{step.title}</div>
                    <p className="text-sm text-[var(--muted)]">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Momentum</div>
              <h3 className="mt-2 text-xl font-semibold">Keep the streak alive.</h3>
              <p className="mt-3 text-sm text-[var(--muted)]">
                The board keeps everyone aligned on what is open, what is done, and what needs a
                quick check-in.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                At a glance
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-4"
                  >
                    <div className="text-lg font-semibold">{metric.value}</div>
                    <div className="mt-2 text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="start"
          className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] px-6 py-10 text-center shadow-[var(--shadow)]"
        >
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Ready to try</div>
          <h2 className="text-3xl font-semibold">Bring everyone onto one calm board.</h2>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Start with the weekly choreboard, then refine together. A steady routine builds itself
            when the board feels easy to return to.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
              href="/auth"
            >
              Start with email
            </Link>
            <button
              className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
              type="button"
            >
              Request a tour
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
