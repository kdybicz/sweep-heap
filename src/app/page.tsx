"use client";

import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const toDateKey = (date: DateTime) => date.toISODate();

const getHouseholdToday = (timeZone: string) => DateTime.now().setZone(timeZone).startOf("day");

const startOfWeek = (date: DateTime) => date.minus({ days: date.weekday - 1 }).startOf("day");

const formatRange = (start: DateTime, end: DateTime) => {
  const sameMonth = start.hasSame(end, "month");
  const sameYear = start.hasSame(end, "year");
  const startLabel = `${start.toFormat("LLL d")}`;
  const endLabel = `${end.toFormat("LLL d")}`;

  if (sameMonth) {
    return `${start.toFormat("LLL d")}–${end.toFormat("d")}, ${start.toFormat("yyyy")}`;
  }

  if (sameYear) {
    return `${startLabel}–${endLabel}, ${start.toFormat("yyyy")}`;
  }

  return `${startLabel}, ${start.toFormat("yyyy")}–${endLabel}, ${end.toFormat("yyyy")}`;
};

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timeZone, setTimeZone] = useState("UTC");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const baseDateRef = useRef<DateTime | null>(null);
  const lastRangeRef = useRef<string | null>(null);
  const [chores, setChores] = useState<
    Array<{
      id: number;
      title: string;
      occurrence_date: string;
      status: string;
      closed_reason?: string | null;
      undo_until?: string | null;
      can_undo?: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const toastTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nowMs, setNowMs] = useState(() => DateTime.utc().toMillis());

  if (!baseDateRef.current) {
    baseDateRef.current = getHouseholdToday(timeZone);
  }

  useEffect(() => {
    baseDateRef.current = getHouseholdToday(timeZone);
  }, [timeZone]);

  const weekStart = useMemo(() => {
    if (rangeStart) {
      return DateTime.fromISO(rangeStart, { zone: timeZone }).startOf("day");
    }
    const baseDate = baseDateRef.current ?? getHouseholdToday(timeZone);
    return startOfWeek(baseDate).plus({ weeks: weekOffset });
  }, [rangeStart, weekOffset, timeZone]);

  const weekEnd = useMemo(() => {
    if (rangeEnd) {
      return DateTime.fromISO(rangeEnd, { zone: timeZone }).startOf("day");
    }
    return weekStart.plus({ days: 6 });
  }, [rangeEnd, timeZone, weekStart]);
  const startKey = useMemo(() => toDateKey(weekStart), [weekStart]);
  const endKey = useMemo(() => toDateKey(weekEnd), [weekEnd]);
  const rangeKey = useMemo(() => `${startKey}:${endKey}`, [startKey, endKey]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index })),
    [weekStart],
  );
  const rangeLabel = formatRange(weekStart, weekEnd);

  useEffect(() => {
    const loadChores = async () => {
      if (lastRangeRef.current === String(weekOffset)) {
        return;
      }
      lastRangeRef.current = String(weekOffset);

      try {
        setLoading(true);
        const response = await fetch(`/api/chores?weekOffset=${weekOffset}&householdId=1`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (data?.ok) {
          setChores(data.chores ?? []);
          if (data.timeZone) {
            setTimeZone((current) => (data.timeZone !== current ? data.timeZone : current));
          }
          if (data.rangeStart && data.rangeEnd) {
            setRangeStart(data.rangeStart);
            setRangeEnd(data.rangeEnd);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadChores();
  }, [weekOffset]);

  const clearToastTick = useCallback(() => {
    if (toastTickRef.current) {
      clearInterval(toastTickRef.current);
      toastTickRef.current = null;
    }
  }, []);

  useEffect(() => {
    const hasActiveUndo = chores.some((chore) => {
      if (!chore.can_undo || !chore.undo_until) {
        return false;
      }
      return DateTime.fromISO(chore.undo_until).toMillis() > DateTime.utc().toMillis();
    });
    if (!hasActiveUndo) {
      clearToastTick();
      return;
    }
    if (toastTickRef.current) {
      return;
    }
    toastTickRef.current = setInterval(() => {
      setNowMs(DateTime.utc().toMillis());
    }, 100);
    return () => {
      clearToastTick();
    };
  }, [chores, clearToastTick]);

  const undoToasts = useMemo(() => {
    return chores
      .filter((chore) => chore.can_undo && chore.undo_until)
      .map((chore) => ({
        choreId: chore.id,
        occurrenceDate: chore.occurrence_date,
        title: chore.title,
        undoUntil: chore.undo_until as string,
      }))
      .filter((toast) => DateTime.fromISO(toast.undoUntil).toMillis() > nowMs)
      .sort(
        (a, b) =>
          DateTime.fromISO(b.undoUntil).toMillis() - DateTime.fromISO(a.undoUntil).toMillis(),
      );
  }, [chores, nowMs]);

  const today = useMemo(() => getHouseholdToday(timeZone), [timeZone]);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const todayChores = useMemo(
    () => chores.filter((chore) => chore.occurrence_date === todayKey),
    [chores, todayKey],
  );
  const doneChores = useMemo(
    () => chores.filter((chore) => chore.status === "closed").length,
    [chores],
  );
  const totalChores = chores.length;
  const openChores = totalChores - doneChores;
  const progress = totalChores ? Math.round((doneChores / totalChores) * 100) : 0;

  const markChoreDone = async (choreId: number, occurrenceDate: string, title: string) => {
    const undoUntil = DateTime.utc().plus({ seconds: 5 }).toISO();
    setChores((prev) =>
      prev.map((chore) =>
        chore.id === choreId && chore.occurrence_date === occurrenceDate
          ? {
              ...chore,
              status: "closed",
              closed_reason: "done",
              undo_until: undoUntil,
              can_undo: true,
            }
          : chore,
      ),
    );
    try {
      const response = await fetch("/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choreId,
          occurrenceDate,
          status: "closed",
          action: "set",
        }),
      });
      const data = await response.json();
      if (!data?.ok) {
        throw new Error(data?.error ?? "Failed to update chore");
      }
      if (data.undo_until) {
        setChores((prev) =>
          prev.map((chore) =>
            chore.id === choreId && chore.occurrence_date === occurrenceDate
              ? {
                  ...chore,
                  status: "closed",
                  closed_reason: "done",
                  undo_until: data.undo_until,
                  can_undo: true,
                }
              : chore,
          ),
        );
      }
    } catch (error) {
      console.error(error);
      setChores((prev) =>
        prev.map((chore) =>
          chore.id === choreId && chore.occurrence_date === occurrenceDate
            ? {
                ...chore,
                status: "open",
                closed_reason: null,
                undo_until: null,
                can_undo: false,
              }
            : chore,
        ),
      );
    }
  };

  const undoChoreDone = async (choreId: number, occurrenceDate: string) => {
    const previous = chores.find(
      (chore) => chore.id === choreId && chore.occurrence_date === occurrenceDate,
    );
    setChores((prev) =>
      prev.map((chore) =>
        chore.id === choreId && chore.occurrence_date === occurrenceDate
          ? {
              ...chore,
              status: "open",
              closed_reason: null,
              undo_until: null,
              can_undo: false,
            }
          : chore,
      ),
    );

    try {
      const response = await fetch("/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choreId,
          occurrenceDate,
          action: "undo",
        }),
      });
      const data = await response.json();
      if (!data?.ok) {
        throw new Error(data?.error ?? "Failed to undo chore");
      }
    } catch (error) {
      console.error(error);
      if (previous) {
        setChores((prev) =>
          prev.map((chore) =>
            chore.id === choreId && chore.occurrence_date === occurrenceDate ? previous : chore,
          ),
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_85%_5%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_45%)]" />
      <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 pb-10 pt-8 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <span className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
              The Sweep Heap
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Weekly Choreboard</h1>
            <p className="text-sm text-[var(--muted)]">
              Make the week feel lighter with a focused, all-day view.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                onClick={() => setWeekOffset(0)}
                type="button"
              >
                Today
              </button>
              <button
                className="rounded-full border border-[var(--stroke)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                type="button"
              >
                Add chore
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Week progress</span>
              <span className="text-xs text-[var(--muted)]">
                {doneChores}/{totalChores} done
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
                <div className="text-lg font-semibold">{totalChores}</div>
                <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                  Total
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
                <div className="text-lg font-semibold">{openChores}</div>
                <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                  Open
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-2 py-3">
                <div className="text-lg font-semibold">{progress}%</div>
                <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                  Done
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Today</span>
              <span className="text-xs text-[var(--muted)]">{today.toFormat("ccc, LLL d")}</span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {loading ? (
                <div className="text-xs text-[var(--muted)]">Loading chores...</div>
              ) : todayChores.length ? (
                <>
                  {todayChores.slice(0, 3).map((chore) => (
                    <div
                      key={`${chore.id}-${chore.occurrence_date}-today`}
                      className="flex items-center justify-between rounded-xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
                    >
                      <span
                        className={
                          chore.status === "closed" ? "text-[var(--muted)] line-through" : ""
                        }
                      >
                        {chore.title}
                      </span>
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                        {chore.status === "closed" ? "Done" : "Open"}
                      </span>
                    </div>
                  ))}
                  {todayChores.length > 3 ? (
                    <div className="text-xs text-[var(--muted)]">
                      +{todayChores.length - 3} more today
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-[var(--muted)]">No chores scheduled</div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex flex-col gap-6">
          <header className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  Week view
                </span>
                <h2 className="text-2xl font-semibold tracking-tight">{rangeLabel}</h2>
                <p className="text-xs text-[var(--muted)]">Week starts on Monday</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  onClick={() => setWeekOffset((value) => value - 1)}
                  type="button"
                >
                  Prev
                </button>
                <button
                  className="rounded-full border border-[var(--stroke)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                  onClick={() => setWeekOffset((value) => value + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </header>

          <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
            <div className="overflow-x-auto">
              <div className="grid min-w-[980px] grid-cols-7 gap-0 divide-x divide-[var(--stroke)]">
                {days.map((day) => {
                  const dayKey = toDateKey(day);
                  const dayChores = chores.filter((chore) => chore.occurrence_date === dayKey);
                  const isToday = day.hasSame(today, "day");
                  return (
                    <div
                      key={day.toISO()}
                      className="group flex min-h-[480px] flex-col border-y border-[var(--stroke)] bg-[var(--card)] p-3 shadow-[var(--shadow-soft)] first:rounded-l-2xl last:rounded-r-2xl first:border-l last:border-r"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
                            {day.toFormat("ccc")}
                          </span>
                          <span className="text-sm font-semibold text-[var(--ink)]">
                            {day.toFormat("LLL d")}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isToday
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--surface-strong)] text-[var(--ink)]"
                          }`}
                        >
                          {dayChores.length}
                        </span>
                      </div>
                      <div className="mt-4 flex-1 rounded-xl border border-dashed border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-2.5">
                        {loading ? (
                          <div className="text-xs text-[var(--muted)]">Loading chores...</div>
                        ) : dayChores.length ? (
                          <div className="flex flex-col gap-1.5">
                            {dayChores.map((chore) => (
                              <button
                                key={`${chore.id}-${chore.occurrence_date}`}
                                className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[0.7rem] font-semibold transition ${
                                  chore.status === "closed"
                                    ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--muted)] line-through"
                                    : "border-[var(--stroke)] bg-[var(--card)] text-[var(--ink)] hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                                }`}
                                disabled={chore.status === "closed"}
                                onClick={() => {
                                  if (chore.status !== "closed") {
                                    markChoreDone(chore.id, chore.occurrence_date, chore.title);
                                  }
                                }}
                                type="button"
                              >
                                <span>{chore.title}</span>
                                <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                                  {chore.status === "closed" ? "Done" : "Mark"}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--muted)]">No chores scheduled</div>
                        )}
                      </div>
                      <button
                        className="mt-3 rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                        type="button"
                      >
                        Add chore
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
      {undoToasts.length ? (
        <div className="fixed bottom-6 left-6 right-6 z-50 mx-auto flex max-w-md flex-col gap-3">
          {undoToasts.map((toast) => {
            const remainingMs = Math.max(0, DateTime.fromISO(toast.undoUntil).toMillis() - nowMs);
            const progress = Math.min(100, (remainingMs / 5000) * 100);
            return (
              <div
                key={`${toast.choreId}-${toast.occurrenceDate}`}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--card)] px-4 py-3 text-xs font-semibold text-[var(--ink)] shadow-[var(--shadow)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[var(--muted)]">Marked done</span>
                    <span>{toast.title}</span>
                  </div>
                  <button
                    className="rounded-full border border-[var(--stroke)] px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                    onClick={() => undoChoreDone(toast.choreId, toast.occurrenceDate)}
                    type="button"
                  >
                    Undo
                  </button>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
