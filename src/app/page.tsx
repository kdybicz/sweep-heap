import Link from "next/link";

import { redirectSignedInUserToApp } from "@/lib/page-access";

const supportPoints = [
  {
    title: "Right household, right route",
    copy: "Magic links send each person to the board, setup, or selector they actually need.",
    accent: "var(--accent-secondary)",
  },
  {
    title: "Repeat without calendar drag",
    copy: "Recurring chores stay visible in the week instead of disappearing into another app.",
    accent: "var(--accent)",
  },
  {
    title: "See today in one glance",
    copy: "Open work, finished work, and the next handoff all live in the same surface.",
    accent: "var(--accent-tertiary)",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Enter once",
    copy: "Sign in with email and skip passwords entirely.",
    note: "Magic link sign-in",
    tone: "var(--accent-secondary-soft)",
    accent: "var(--accent-secondary)",
  },
  {
    number: "02",
    title: "Land in the right household",
    copy: "Create one, join one, or choose between them without losing context.",
    note: "Invite and setup flow",
    tone: "var(--accent-soft)",
    accent: "var(--accent)",
  },
  {
    number: "03",
    title: "Run the week from one board",
    copy: "Track progress, reset the week, and keep chores moving from a single view.",
    note: "Live weekly board",
    tone: "var(--accent-tertiary-soft)",
    accent: "var(--accent-tertiary)",
  },
];

const previewDays = [
  { label: "Mon", date: "12" },
  { label: "Tue", date: "13", today: true },
  { label: "Wed", date: "14" },
  { label: "Thu", date: "15" },
  { label: "Fri", date: "16" },
  { label: "Sat", date: "17" },
  { label: "Sun", date: "18" },
];

const previewTasks = [
  {
    title: "Kitchen reset",
    meta: "Today",
    span: "col-span-2",
    fill: "var(--accent)",
    text: "var(--surface-weak)",
  },
  {
    title: "Laundry loop",
    meta: "Repeat",
    span: "col-span-1",
    fill: "var(--accent-secondary-soft)",
    text: "var(--ink)",
  },
  {
    title: "Entry sweep",
    meta: "Open",
    span: "col-span-2",
    fill: "var(--accent-gold-soft)",
    text: "var(--ink)",
  },
  {
    title: "Plants + water",
    meta: "Done",
    span: "col-span-2",
    fill: "var(--accent-tertiary-soft)",
    text: "var(--ink)",
  },
  {
    title: "Bins out",
    meta: "Tonight",
    span: "col-span-1",
    fill: "var(--surface-strong)",
    text: "var(--ink)",
  },
  {
    title: "Bathrooms",
    meta: "Repeat",
    span: "col-span-2",
    fill: "var(--accent-secondary)",
    text: "var(--surface-weak)",
  },
  {
    title: "Sheets",
    meta: "Weekend",
    span: "col-span-2",
    fill: "var(--surface-strong)",
    text: "var(--ink)",
  },
  {
    title: "Floors",
    meta: "Open",
    span: "col-span-2",
    fill: "var(--accent-gold-soft)",
    text: "var(--ink)",
  },
];

const todayPreview = [
  { title: "Kitchen reset", status: "Open", accent: "var(--accent)" },
  { title: "Laundry loop", status: "Repeat", accent: "var(--accent-secondary)" },
  { title: "Plants + water", status: "Done", accent: "var(--accent-tertiary)" },
];

export default async function LandingPage() {
  await redirectSignedInUserToApp();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <section className="relative isolate min-h-[100svh] overflow-hidden border-b border-[var(--stroke-soft)]">
        <div className="ambient-drift absolute inset-0 -z-30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--bg)_78%,white_22%),color-mix(in_srgb,var(--surface)_78%,white_22%))]" />
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,var(--glow-1),transparent_28%),radial-gradient(circle_at_78%_14%,var(--glow-2),transparent_26%),radial-gradient(circle_at_64%_78%,var(--glow-3),transparent_28%)]" />
        <div className="editorial-grid absolute inset-0 -z-10 opacity-35" />

        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 pb-5 pt-5 sm:px-6 lg:px-8 lg:pb-6 lg:pt-6">
          <div className="landing-reveal flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--surface-weak)] font-display text-sm font-semibold uppercase tracking-[0.12em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent-secondary)]">
                The Sweep Heap
              </span>
              <span className="text-sm font-medium text-[var(--muted)]">
                Bright weekly planning for shared homes.
              </span>
            </div>
          </div>

          <Link
            className="landing-reveal landing-reveal-delay-1 rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface-weak)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface)]"
            href="/auth"
          >
            Sign in
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-4 pb-12 pt-2 sm:px-6 lg:min-h-[calc(100svh-84px)] lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:px-8 lg:pb-14">
          <div className="landing-reveal landing-reveal-delay-1 flex max-w-[29rem] flex-col gap-6 self-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-secondary)]">
              The Sweep Heap
            </p>
            <h1
              className="font-display max-w-[8ch] text-5xl font-semibold leading-none tracking-[-0.07em] sm:text-6xl md:text-7xl"
              style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 1" }}
            >
              The Sweep Heap
            </h1>
            <p className="max-w-[17ch] text-2xl leading-tight text-[var(--ink)] sm:text-3xl">
              A brighter weekly board for every household.
            </p>
            <p className="max-w-md text-sm leading-7 text-[var(--muted)] sm:text-base">
              Plan repeats, catch what matters today, and move each person into the right home flow
              without extra clutter.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                className="rounded-[var(--radius-md)] border border-transparent bg-[var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-[0_10px_28px_rgba(217,90,58,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(217,90,58,0.28)]"
                href="/auth"
              >
                Start with email
              </Link>
              <a
                className="rounded-[var(--radius-md)] border border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface)]"
                href="#workflow"
              >
                See the board
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              <span>Magic links only</span>
              <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />
              <span>Invite-based setup</span>
              <span className="h-1 w-1 rounded-full bg-[var(--accent-secondary)]" />
              <span>Weekly board at a glance</span>
            </div>
          </div>

          <div className="landing-reveal landing-reveal-delay-2 relative lg:justify-self-end">
            <div className="absolute -left-10 top-8 h-28 w-28 bg-[var(--accent-soft)] blur-3xl" />
            <div className="absolute -right-10 bottom-10 h-36 w-36 bg-[var(--accent-secondary-soft)] blur-3xl" />
            <div className="paper-grain poster-float relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_76%,white_24%)] p-3 shadow-[var(--shadow-lifted)] sm:p-4">
              <div className="absolute inset-0 bg-[linear-gradient(140deg,transparent,rgba(255,255,255,0.26)_45%,transparent_60%)] opacity-70" />
              <div className="relative grid gap-3 lg:grid-cols-[238px_minmax(0,1fr)]">
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft)] pb-4">
                    <div>
                      <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--accent-secondary)]">
                        Household rhythm
                      </div>
                      <div
                        className="font-display mt-2 text-3xl font-bold tracking-[-0.03em]"
                        style={{ fontVariationSettings: "'SOFT' 40" }}
                      >
                        74%
                      </div>
                    </div>
                    <span className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--accent-tertiary)_20%,transparent)] bg-[var(--accent-tertiary-soft)] px-3 py-1 text-[0.58rem] font-bold tracking-[0.06em] text-[var(--accent-tertiary)]">
                      14 done
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      <span>This week</span>
                      <span>Tue focus</span>
                    </div>
                    <div className="mt-3 h-[5px] overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-strong)]">
                      <div
                        className="h-full rounded-[var(--radius-full)] bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-tertiary))]"
                        style={{ width: "74%" }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-2.5">
                      <div className="font-mono text-base font-semibold">19</div>
                      <div className="mt-0.5 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                        Total
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--accent-gold-soft)] px-2 py-2.5">
                      <div className="font-mono text-base font-semibold">5</div>
                      <div className="mt-0.5 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                        Open
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--accent-tertiary-soft)] px-2 py-2.5">
                      <div className="font-mono text-base font-semibold">3</div>
                      <div className="mt-0.5 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                        Today
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      <span>Today</span>
                      <span>Tue, May 13</span>
                    </div>
                    {todayPreview.map((item) => (
                      <div
                        className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-[0.72rem] font-semibold transition hover:translate-x-[3px] hover:border-[var(--accent)]"
                        key={item.title}
                      >
                        <span>{item.title}</span>
                        <span
                          className="text-[0.56rem] font-bold uppercase tracking-[0.08em]"
                          style={{ color: item.accent }}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)]">
                  <div className="flex items-center justify-between border-b border-[var(--stroke-soft)] bg-[color-mix(in_srgb,var(--accent-secondary-soft)_40%,var(--surface-weak)_60%)] px-4 py-3.5">
                    <div>
                      <div className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[var(--accent-secondary)]">
                        Weekly board
                      </div>
                      <div
                        className="font-display mt-1 text-xl font-semibold tracking-[-0.02em]"
                        style={{ fontVariationSettings: "'SOFT' 50" }}
                      >
                        May 12 &ndash; May 18
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--card)] text-[0.7rem] font-bold text-[var(--ink)]">
                        &lsaquo;
                      </span>
                      <span className="flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--card)] px-3 text-[0.7rem] font-bold text-[var(--ink)]">
                        Today
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stroke)] bg-[var(--card)] text-[0.7rem] font-bold text-[var(--ink)]">
                        &rsaquo;
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-2.5">
                    {previewDays.map((day) => (
                      <div className="flex justify-center px-1" key={day.label}>
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {day.label}
                          </span>
                          <span
                            className="font-mono flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[0.7rem] font-semibold"
                            style={
                              day.today
                                ? {
                                    background: "var(--accent)",
                                    color: "white",
                                  }
                                : undefined
                            }
                          >
                            {day.date}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid min-h-[220px] grid-cols-7 gap-1.5 bg-[var(--card)] p-2">
                    {previewTasks.map((task) => (
                      <div
                        className={`${task.span} h-fit cursor-pointer rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2.5 py-2.5 text-[0.7rem] font-semibold shadow-[0_2px_6px_rgba(42,37,34,0.05)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:-translate-y-[3px] hover:-rotate-[0.5deg] hover:shadow-[0_10px_24px_rgba(42,37,34,0.13)]`}
                        key={task.title}
                        style={{ backgroundColor: task.fill, color: task.text }}
                      >
                        <div className="leading-[1.3]">{task.title}</div>
                        <div className="mt-1 text-[0.52rem] font-semibold uppercase tracking-[0.08em] opacity-70">
                          {task.meta}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="paper-grain section-divider relative overflow-hidden bg-[color-mix(in_srgb,var(--surface)_84%,white_16%)]">
          <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8 lg:py-24">
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                One clear promise
              </p>
              <h2
                className="font-display mt-4 max-w-[12ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl"
                style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 1" }}
              >
                Built for the handoff between today and next week.
              </h2>
            </div>

            <div className="grid gap-0 border-t border-[var(--stroke-soft)]">
              {supportPoints.map((point) => (
                <div
                  className="grid gap-3 border-b border-[var(--stroke-soft)] py-6 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-6 sm:py-7"
                  key={point.title}
                >
                  <div
                    className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: point.accent }}
                  >
                    Focus
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-[-0.03em]">
                      {point.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                      {point.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="dot-grid section-divider relative">
          <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-24">
            <div className="max-w-md lg:sticky lg:top-10 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-secondary)]">
                Workflow
              </p>
              <h2
                className="font-display mt-4 max-w-[14ch] text-[clamp(2rem,3.5vw,2.8rem)] font-semibold leading-[1.1] tracking-[-0.025em]"
                style={{ fontVariationSettings: "'SOFT' 60" }}
              >
                Three moments. No extra admin.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
                Each section does one job: get in, land correctly, and run the week without hunting
                through menus.
              </p>
            </div>

            <div className="grid gap-4">
              {workflowSteps.map((step) => (
                <article
                  className="rounded-[var(--radius-lg)] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
                  key={step.number}
                >
                  <div className="flex items-start gap-5">
                    <div
                      className="font-display min-w-[48px] text-[2rem] font-bold leading-none"
                      style={{
                        color: step.accent,
                        fontVariationSettings: "'SOFT' 80, 'WONK' 1",
                      }}
                    >
                      {step.number}
                    </div>
                    <div>
                      <h3
                        className="font-display text-[1.3rem] font-semibold tracking-[-0.01em]"
                        style={{ fontVariationSettings: "'SOFT' 50" }}
                      >
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[0.88rem] leading-[1.7] text-[var(--muted)]">
                        {step.copy}
                      </p>
                      <div
                        className="mt-3 inline-flex rounded-[var(--radius-sm)] border border-[var(--stroke-soft)] px-4 py-2 text-[0.72rem] font-bold tracking-[0.04em]"
                        style={{ backgroundColor: step.tone, color: step.accent }}
                      >
                        {step.note}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-divider relative overflow-hidden bg-[var(--ink)] text-[var(--surface-weak)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(217,90,58,0.2),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(61,107,224,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
          <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-gold)]">
                Start simply
              </p>
              <h2
                className="font-display mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl"
                style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 1" }}
              >
                Bring the whole household onto one sharper board.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(255,255,255,0.74)] sm:text-base">
                Sign in with email and we will route you to setup, household selection, or the live
                board without extra steps.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-3">
              <Link
                className="rounded-[var(--radius-md)] border border-transparent bg-[var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(217,90,58,0.22)]"
                href="/auth"
              >
                Continue with email
              </Link>
              <a
                className="rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--surface-weak)] transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.12)]"
                href="#workflow"
              >
                Review workflow
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
