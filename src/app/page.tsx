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
    text: "#fffdfa",
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
    text: "#fffdfa",
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
    fill: "var(--accent-gold)",
    text: "#1d2742",
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
            <div className="flex h-12 w-12 items-center justify-center border border-[var(--stroke)] bg-[var(--surface-weak)] text-sm font-semibold uppercase tracking-[0.3em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] uppercase tracking-[0.34em] text-[var(--accent-secondary)]">
                The Sweep Heap
              </span>
              <span className="text-sm font-medium text-[var(--muted)]">
                Bright weekly planning for shared homes.
              </span>
            </div>
          </div>

          <Link
            className="landing-reveal landing-reveal-delay-1 rounded-[0.8rem] border border-[var(--stroke)] bg-[var(--surface-weak)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface)]"
            href="/auth"
          >
            Sign in
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-4 pb-12 pt-2 sm:px-6 lg:min-h-[calc(100svh-84px)] lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:px-8 lg:pb-14">
          <div className="landing-reveal landing-reveal-delay-1 flex max-w-[29rem] flex-col gap-6 self-center">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent-secondary)]">
              The Sweep Heap
            </p>
            <h1 className="max-w-[8ch] text-5xl font-semibold leading-none tracking-[-0.07em] sm:text-6xl md:text-7xl">
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
                className="rounded-[0.8rem] border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-[0_16px_30px_rgba(40,94,240,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(40,94,240,0.28)]"
                href="/auth"
              >
                Start with email
              </Link>
              <a
                className="rounded-[0.8rem] border border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:border-[var(--accent-secondary)] hover:bg-[var(--surface)]"
                href="#workflow"
              >
                See the board
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Magic links only</span>
              <span className="h-1 w-1 rounded-[2px] bg-[var(--accent)]" />
              <span>Invite-based setup</span>
              <span className="h-1 w-1 rounded-[2px] bg-[var(--accent-secondary)]" />
              <span>Weekly board at a glance</span>
            </div>
          </div>

          <div className="landing-reveal landing-reveal-delay-2 relative lg:justify-self-end">
            <div className="absolute -left-10 top-8 h-28 w-28 bg-[var(--accent-soft)] blur-3xl" />
            <div className="absolute -right-10 bottom-10 h-36 w-36 bg-[var(--accent-secondary-soft)] blur-3xl" />
            <div className="poster-float relative overflow-hidden border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_76%,white_24%)] p-3 shadow-[0_28px_80px_rgba(53,37,24,0.18)] sm:p-4">
              <div className="absolute inset-0 bg-[linear-gradient(140deg,transparent,rgba(255,255,255,0.26)_45%,transparent_60%)] opacity-70" />
              <div className="relative grid gap-3 lg:grid-cols-[238px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3 border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft)] pb-4">
                    <div>
                      <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
                        Household rhythm
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-[-0.05em]">74%</div>
                    </div>
                    <span className="border border-[var(--accent-tertiary)] bg-[var(--accent-tertiary-soft)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
                      14 done
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                      <span>This week</span>
                      <span>Tue focus</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden bg-[var(--surface-strong)]">
                      <div
                        className="h-full bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-tertiary))]"
                        style={{ width: "74%" }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-3">
                      <div className="text-lg font-semibold">19</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Total
                      </div>
                    </div>
                    <div className="border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-3">
                      <div className="text-lg font-semibold">5</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Open
                      </div>
                    </div>
                    <div className="border border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-3">
                      <div className="text-lg font-semibold">3</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Today
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border border-[var(--stroke-soft)] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      <span>Today</span>
                      <span>Tue, May 13</span>
                    </div>
                    {todayPreview.map((item) => (
                      <div
                        className="flex items-center justify-between border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
                        key={item.title}
                      >
                        <span>{item.title}</span>
                        <span
                          className="text-[0.58rem] uppercase tracking-[0.18em]"
                          style={{ color: item.accent }}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden border border-[var(--stroke-soft)] bg-[var(--surface-weak)]">
                  <div className="flex items-center justify-between border-b border-[var(--stroke-soft)] px-4 py-4">
                    <div>
                      <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[var(--accent)]">
                        Weekly board
                      </div>
                      <div className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                        May 12 - May 18
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="border border-[var(--stroke-soft)] bg-[var(--accent-gold-soft)] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
                        Repeatable
                      </span>
                      <span className="border border-[var(--stroke-soft)] bg-[var(--accent-secondary-soft)] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
                        Shared
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-3">
                    {previewDays.map((day) => (
                      <div className="flex justify-center px-1" key={day.label}>
                        <div className="flex flex-col items-center gap-2 text-center">
                          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {day.label}
                          </span>
                          <span
                            className="flex h-8 w-8 items-center justify-center text-xs font-semibold"
                            style={
                              day.today
                                ? {
                                    background:
                                      "linear-gradient(135deg, var(--accent), var(--accent-secondary))",
                                    color: "#fffdfa",
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

                  <div className="grid min-h-[292px] grid-cols-7 gap-2 bg-[var(--surface)] p-3">
                    {previewTasks.map((task) => (
                      <div
                        className={`${task.span} h-fit border border-[color-mix(in_srgb,var(--ink)_8%,transparent)] px-3 py-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
                        key={task.title}
                        style={{ backgroundColor: task.fill, color: task.text }}
                      >
                        <div>{task.title}</div>
                        <div className="mt-1 text-[0.58rem] font-medium uppercase tracking-[0.16em] opacity-75">
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
        <section className="section-divider relative overflow-hidden bg-[color-mix(in_srgb,var(--surface)_84%,white_16%)]">
          <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8 lg:py-24">
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">
                One clear promise
              </p>
              <h2 className="mt-4 max-w-[12ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
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
                    className="text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: point.accent }}
                  >
                    Focus
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em]">{point.title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                      {point.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="section-divider relative">
          <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-24">
            <div className="max-w-md lg:sticky lg:top-10 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent-secondary)]">
                Workflow
              </p>
              <h2 className="mt-4 max-w-[13ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Three moments. No extra admin.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
                Each section does one job: get in, land correctly, and run the week without hunting
                through menus.
              </p>
            </div>

            <div className="grid gap-5">
              {workflowSteps.map((step) => (
                <article
                  className="border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
                  key={step.number}
                >
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-xl">
                      <div
                        className="text-[0.68rem] font-semibold uppercase tracking-[0.28em]"
                        style={{ color: step.accent }}
                      >
                        {step.number}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
                        {step.copy}
                      </p>
                    </div>
                    <div
                      className="min-w-[12rem] border border-[var(--stroke-soft)] px-4 py-4 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:text-left"
                      style={{ backgroundColor: step.tone }}
                    >
                      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Surface
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--ink)]">
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,123,91,0.2),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(135,168,255,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
          <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent-gold)]">
                Start simply
              </p>
              <h2 className="mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Bring the whole household onto one sharper board.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(255,253,248,0.72)] sm:text-base">
                Sign in with email and we will route you to setup, household selection, or the live
                board without extra steps.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-3">
              <Link
                className="rounded-[0.8rem] border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(40,94,240,0.22)]"
                href="/auth"
              >
                Continue with email
              </Link>
              <a
                className="rounded-[0.8rem] border border-[rgba(255,253,248,0.18)] bg-[rgba(255,253,248,0.06)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--surface-weak)] transition hover:-translate-y-0.5 hover:bg-[rgba(255,253,248,0.12)]"
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
