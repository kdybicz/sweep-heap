import Link from "next/link";

import { redirectSignedInUserToApp } from "@/lib/page-access";

const proofPoints = [
  "Weekly board for the whole household",
  "Repeating chores without calendar sprawl",
  "Email sign-in and invite-based setup",
];

const steps = [
  {
    title: "Sign in with email",
    copy: "Use a magic link to open the app without passwords or setup friction.",
  },
  {
    title: "Create or join a household",
    copy: "Start your own space or accept an invite and pick up where the household already is.",
  },
  {
    title: "Run the week from one board",
    copy: "See what is due, what repeats, and what is already done without digging through menus.",
  },
];

const previewDays = [
  { label: "Mon", date: "12", state: "Calm" },
  { label: "Tue", date: "13", state: "Today" },
  { label: "Wed", date: "14", state: "Open" },
  { label: "Thu", date: "15", state: "Open" },
  { label: "Fri", date: "16", state: "Light" },
  { label: "Sat", date: "17", state: "Reset" },
  { label: "Sun", date: "18", state: "Reset" },
];

const previewChips = [
  {
    title: "Kitchen reset",
    span: "col-span-2",
    tone: "bg-[var(--accent)] text-white shadow-[0_18px_35px_rgba(42,91,215,0.22)]",
  },
  {
    title: "Laundry cycle",
    span: "col-span-1",
    tone: "bg-[var(--surface-strong)] text-[var(--ink)]",
  },
  {
    title: "Entry sweep",
    span: "col-span-2",
    tone: "bg-[var(--surface-weak)] text-[var(--ink)]",
  },
  {
    title: "Plants + water",
    span: "col-span-2",
    tone: "bg-[var(--surface-weak)] text-[var(--ink)]",
  },
  {
    title: "Bins out",
    span: "col-span-1",
    tone: "bg-[var(--surface-strong)] text-[var(--ink)]",
  },
  {
    title: "Sheets",
    span: "col-span-2",
    tone: "bg-[var(--surface-weak)] text-[var(--ink)]",
  },
  {
    title: "Bathrooms",
    span: "col-span-2",
    tone: "bg-[var(--surface-weak)] text-[var(--ink)]",
  },
  {
    title: "Floors",
    span: "col-span-2",
    tone: "bg-[var(--surface-strong)] text-[var(--ink)]",
  },
];

const todayTasks = ["Kitchen reset", "Laundry cycle", "Plants + water"];

export default async function LandingPage() {
  await redirectSignedInUserToApp();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden border-b border-[var(--stroke-soft)]">
        <div
          className="absolute inset-0 -z-20"
          style={{
            backgroundImage:
              "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 82%, white 18%))",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_78%_22%,rgba(42,91,215,0.18),transparent_28%),radial-gradient(circle_at_70%_80%,rgba(255,232,204,0.42),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(110,160,255,0.18),transparent_28%),radial-gradient(circle_at_70%_80%,rgba(110,160,255,0.1),transparent_24%)]" />
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pb-6 pt-6 sm:pt-8">
          <div className="landing-reveal flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-weak)] text-sm font-semibold uppercase tracking-[0.28em] shadow-[var(--shadow-soft)]">
              SH
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] uppercase tracking-[0.32em] text-[var(--muted)]">
                The Sweep Heap
              </span>
              <span className="text-sm font-medium text-[var(--muted)]">
                Weekly chores, kept simple.
              </span>
            </div>
          </div>

          <Link
            className="landing-reveal landing-reveal-delay-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            href="/auth"
          >
            Sign in
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-14 pt-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-16 lg:pb-16">
          <div className="landing-reveal landing-reveal-delay-1 flex max-w-xl flex-col gap-6 self-center">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--muted)]">
              The Sweep Heap
            </p>
            <h1 className="max-w-[9ch] text-5xl font-semibold leading-none tracking-[-0.05em] text-[var(--ink)] sm:text-6xl md:text-7xl">
              The Sweep Heap
            </h1>
            <p className="max-w-lg text-xl leading-8 text-[var(--ink)] sm:text-2xl">
              A calm weekly board for the people who keep home running.
            </p>
            <p className="max-w-md text-sm leading-7 text-[var(--muted)] sm:text-base">
              Plan the week, track what matters today, repeat what repeats, and keep everyone in the
              same flow without clutter.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                href="/auth"
              >
                Sign in with email
              </Link>
              <a
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                href="#how-it-works"
              >
                See how it works
              </a>
            </div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Already signed in? You will jump straight to your board.
            </p>
          </div>

          <div className="landing-reveal landing-reveal-delay-2 relative self-center lg:justify-self-end">
            <div className="absolute -left-6 top-8 h-36 w-36 rounded-full bg-[rgba(255,255,255,0.5)] blur-3xl dark:bg-[rgba(110,160,255,0.08)]" />
            <div className="absolute -right-8 bottom-6 h-40 w-40 rounded-full bg-[rgba(42,91,215,0.16)] blur-3xl dark:bg-[rgba(110,160,255,0.12)]" />
            <div
              className="relative overflow-hidden rounded-[2rem] border border-[var(--stroke)] p-3 shadow-[0_24px_80px_rgba(23,35,75,0.16)] sm:p-4"
              style={{
                backgroundImage:
                  "linear-gradient(160deg, color-mix(in srgb, var(--surface) 76%, white 24%), color-mix(in srgb, var(--surface-weak) 86%, white 14%))",
              }}
            >
              <div className="grid gap-3 rounded-[1.65rem] border border-[var(--stroke-soft)] bg-[var(--surface)] p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3 rounded-[1.35rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[0.62rem] uppercase tracking-[0.24em] text-[var(--muted)]">
                        Weekly progress
                      </div>
                      <div className="mt-2 text-2xl font-semibold">68%</div>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      11 done
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                    <div className="h-full w-[68%] rounded-full bg-[var(--accent)]" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-[var(--surface)] px-2 py-3">
                      <div className="text-base font-semibold">16</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Total
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] px-2 py-3">
                      <div className="text-base font-semibold">5</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Open
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] px-2 py-3">
                      <div className="text-base font-semibold">3</div>
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                        Today
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-[1.15rem] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between text-[0.68rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                      <span>Today</span>
                      <span>Tue, May 13</span>
                    </div>
                    {todayTasks.map((task) => (
                      <div
                        className="flex items-center justify-between rounded-xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
                        key={task}
                      >
                        <span>{task}</span>
                        <span className="text-[0.55rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                          Open
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.35rem] border border-[var(--stroke-soft)] bg-[var(--surface-weak)]">
                  <div className="flex items-center justify-between border-b border-[var(--stroke-soft)] px-4 py-4">
                    <div>
                      <div className="text-[0.62rem] uppercase tracking-[0.24em] text-[var(--muted)]">
                        Weekly board
                      </div>
                      <div className="mt-1 text-xl font-semibold">May 12 - May 18</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full border border-[var(--stroke)] bg-[var(--surface)]" />
                      <div className="h-9 w-9 rounded-full border border-[var(--stroke)] bg-[var(--surface)]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-7 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-2 py-3">
                    {previewDays.map((day) => {
                      const isToday = day.state === "Today";

                      return (
                        <div className="flex justify-center px-1" key={day.label}>
                          <div className="flex flex-col items-center gap-2 text-center">
                            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                              {day.label}
                            </span>
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                                isToday
                                  ? "bg-[var(--accent)] text-white"
                                  : "bg-[var(--surface)] text-[var(--ink)]"
                              }`}
                            >
                              {day.date}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid min-h-[260px] grid-cols-7 gap-2 bg-[var(--surface-weak)] p-3">
                    {previewChips.map((chip) => (
                      <div
                        className={`${chip.span} h-fit rounded-2xl px-3 py-3 text-xs font-semibold ${chip.tone}`}
                        key={chip.title}
                      >
                        <div>{chip.title}</div>
                        <div className="mt-1 text-[0.58rem] font-medium uppercase tracking-[0.16em] opacity-75">
                          Weekly routine
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
        <section className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]/40">
          <div className="mx-auto grid w-full max-w-6xl gap-0 px-4 py-5 md:grid-cols-3">
            {proofPoints.map((point, index) => (
              <div
                className={`py-4 text-sm leading-7 text-[var(--ink)] ${
                  index > 0 ? "border-t border-[var(--stroke-soft)] md:border-l md:border-t-0" : ""
                } md:px-6 ${index === 0 ? "md:pl-0" : ""} ${
                  index === proofPoints.length - 1 ? "md:pr-0" : ""
                }`}
                key={point}
              >
                {point}
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16">
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--muted)]">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                One board, one rhythm, less overhead.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
                The product already does the heavy lifting. The landing page should say that
                plainly: get in, see the week, and keep the household moving.
              </p>
            </div>

            <div className="border-t border-[var(--stroke-soft)]">
              {steps.map((step, index) => (
                <div
                  className="grid gap-3 border-b border-[var(--stroke-soft)] py-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6 sm:py-7"
                  key={step.title}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">
                      {step.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="start" className="border-t border-[var(--stroke-soft)]">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--muted)]">
              Start simply
            </p>
            <h2 className="max-w-[12ch] text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Bring the whole household onto one calm board.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              Sign in with email, then we will send you to the right next step: your board, a
              household setup flow, or household selection.
            </p>
            <Link
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
              href="/auth"
            >
              Continue with email
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
