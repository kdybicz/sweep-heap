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
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_60%),radial-gradient(circle_at_20%_20%,_rgba(255,211,170,0.4),_transparent_40%),radial-gradient(circle_at_80%_10%,_rgba(255,240,214,0.6),_transparent_45%)]" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-12 pt-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Chores</span>
              <h1 className="text-3xl font-semibold tracking-tight">Weekly Overview</h1>
              <p className="text-sm text-[var(--muted)]">
                All-day columns, no time slots, just the week ahead.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                onClick={() => setWeekOffset(0)}
                type="button"
              >
                Today
              </button>
              <div className="flex items-center rounded-full border border-[var(--stroke)] bg-white text-sm font-medium">
                <button
                  className="px-4 py-2 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setWeekOffset((value) => value - 1)}
                  type="button"
                >
                  ←
                </button>
                <span className="px-4 py-2 text-[var(--muted)]">{rangeLabel}</span>
                <button
                  className="px-4 py-2 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setWeekOffset((value) => value + 1)}
                  type="button"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--stroke)] px-2 pb-4">
            <div className="text-sm font-medium text-[var(--muted)]">Week view</div>
            <div className="text-xs text-[var(--muted)]">Week starts on Monday</div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 gap-3">
              {days.map((day) => {
                const dayKey = toDateKey(day);
                const dayChores = chores.filter((chore) => chore.occurrence_date === dayKey);
                const isToday = day.hasSame(getHouseholdToday(timeZone), "day");
                return (
                  <div
                    key={day.toISO()}
                    className="flex min-h-[420px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--card)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
                        {day.toFormat("ccc")}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isToday
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--surface-strong)] text-[var(--ink)]"
                        }`}
                      >
                        {day.toFormat("d")}
                      </span>
                    </div>
                    <div className="mt-6 flex-1 rounded-xl border border-dashed border-[var(--stroke-soft)] bg-[var(--surface-weak)] p-3">
                      {loading ? (
                        <div className="text-xs text-[var(--muted)]">Loading chores...</div>
                      ) : dayChores.length ? (
                        <div className="flex flex-col gap-2">
                          {dayChores.map((chore) => (
                            <button
                              key={`${chore.id}-${chore.occurrence_date}`}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                                chore.status === "closed"
                                  ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--muted)] line-through"
                                  : "border-[var(--stroke)] bg-white text-[var(--ink)] hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
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
                              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
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
                      className="mt-4 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                      type="button"
                    >
                      Add chore
                    </button>
                  </div>
                );
              })}
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
                className="flex flex-col gap-3 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--ink)] shadow-[var(--shadow)]"
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
