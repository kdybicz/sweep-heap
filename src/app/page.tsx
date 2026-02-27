"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const baseDateRef = useRef<DateTime | null>(null);
  const lastRangeRef = useRef<string | null>(null);
  const [chores, setChores] = useState<
    Array<{ id: number; title: string; occurrence_date: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  if (!baseDateRef.current) {
    baseDateRef.current = getHouseholdToday(timeZone);
  }

  useEffect(() => {
    baseDateRef.current = getHouseholdToday(timeZone);
    lastRangeRef.current = null;
  }, [timeZone]);

  const weekStart = useMemo(() => {
    const baseDate = baseDateRef.current ?? getHouseholdToday(timeZone);
    return startOfWeek(baseDate).plus({ weeks: weekOffset });
  }, [weekOffset, timeZone]);

  const weekEnd = useMemo(() => weekStart.plus({ days: 6 }), [weekStart]);
  const startKey = useMemo(() => toDateKey(weekStart), [weekStart]);
  const endKey = useMemo(() => toDateKey(weekEnd), [weekEnd]);
  const rangeKey = useMemo(() => `${startKey}:${endKey}`, [startKey, endKey]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index })),
    [weekStart],
  );
  const rangeLabel = formatRange(weekStart, weekEnd);

  useEffect(() => {
    if (lastRangeRef.current === rangeKey) {
      return;
    }
    lastRangeRef.current = rangeKey;

    const loadChores = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/chores?start=${startKey}&end=${endKey}&householdId=1`);
        const data = await response.json();
        if (data?.ok) {
          setChores(data.chores ?? []);
          if (data.timeZone && data.timeZone !== timeZone) {
            setTimeZone(data.timeZone);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadChores();
  }, [rangeKey, startKey, endKey]);

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
                            <div
                              key={chore.id}
                              className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]"
                            >
                              {chore.title}
                            </div>
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
    </div>
  );
}
