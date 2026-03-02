"use client";

import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SignOutButton from "@/app/heap/SignOutButton";
import type { ChoreStateInput, ChoreType } from "@/lib/chore-ui-state";
import {
  getChoreStateLabel,
  getChoreTypeLabel,
  getChoreVisualState,
  getPrimaryActionLabel,
  isChoreCompleted,
  isPrimaryActionDisabled,
} from "@/lib/chore-ui-state";

const toDateKey = (date: DateTime) => date.toISODate();

const getHouseholdToday = (timeZone: string) => DateTime.now().setZone(timeZone).startOf("day");
const getHouseholdTodayKey = (timeZone: string) =>
  toDateKey(getHouseholdToday(timeZone)) ?? DateTime.utc().toISODate() ?? "";

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

const TypeIcon = ({ type, className }: { type: ChoreType; className?: string }) => {
  if (type === "stay_open") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 7h9m0 0-2.5-2.5M13 7l-2.5 2.5M16 13H7m0 0 2.5-2.5M7 13l2.5 2.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m6.5 10 2.2 2.2 4.8-4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

const StateIcon = ({ chore, className }: { chore: ChoreStateInput; className?: string }) => {
  const state = getChoreVisualState(chore);
  if (state === "completed") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m6.5 10 2.2 2.2 4.8-4.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (state === "logged") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="10" cy="10" fill="currentColor" r="2.2" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      {state === "closed" ? (
        <path
          d="m7.3 7.3 5.4 5.4m0-5.4-5.4 5.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
};

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timeZone, setTimeZone] = useState("UTC");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const baseDateRef = useRef<DateTime | null>(null);
  const lastRangeRef = useRef<string | null>(null);
  type ChoreItem = {
    id: number;
    title: string;
    type: ChoreType;
    occurrence_date: string;
    status: string;
    closed_reason?: string | null;
    undo_until?: string | null;
    can_undo?: boolean;
    notes?: string | null;
  };

  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingToday, setLoadingToday] = useState(true);
  const toastTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nowMs, setNowMs] = useState(() => DateTime.utc().toMillis());
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ChoreType>("close_on_done");
  const [newDate, setNewDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeat, setNewRepeat] = useState("none");
  const [newEndDate, setNewEndDate] = useState(() => getHouseholdTodayKey(timeZone));
  const [newRepeatEnd, setNewRepeatEnd] = useState(() => getHouseholdTodayKey(timeZone));
  const [newNotes, setNewNotes] = useState("");
  const [todayChores, setTodayChores] = useState<ChoreItem[]>([]);
  const [selectedChore, setSelectedChore] = useState<ChoreItem | null>(null);

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

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index })),
    [weekStart],
  );
  const rangeLabel = formatRange(weekStart, weekEnd);

  const loadChores = useCallback(
    async ({ force }: { force?: boolean } = {}) => {
      if (!force && lastRangeRef.current === String(weekOffset)) {
        return;
      }
      lastRangeRef.current = String(weekOffset);

      try {
        setLoading(true);
        const response = await fetch(`/api/chores?weekOffset=${weekOffset}`, {
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
        } else if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [weekOffset],
  );

  useEffect(() => {
    loadChores();
  }, [loadChores]);

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

  useEffect(() => {
    if (!newRepeatEnd) {
      setNewRepeatEnd(newDate);
    }
  }, [newDate, newRepeatEnd]);

  const undoToasts = useMemo(() => {
    return chores
      .filter((chore) => chore.can_undo && chore.undo_until)
      .map((chore) => ({
        choreId: chore.id,
        occurrenceDate: chore.occurrence_date,
        title: chore.title,
        type: chore.type,
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
  const loadTodayChores = useCallback(async () => {
    try {
      setLoadingToday(true);
      const response = await fetch(`/api/chores?start=${todayKey}&end=${todayKey}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (data?.error === "Household required") {
        window.location.assign("/household/setup");
        return;
      }
      if (data?.ok) {
        setTodayChores(data.chores ?? []);
        if (data.timeZone) {
          setTimeZone((current) => (data.timeZone !== current ? data.timeZone : current));
        }
      } else if (data?.error === "Household required") {
        window.location.assign("/household/setup");
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingToday(false);
    }
  }, [todayKey]);
  useEffect(() => {
    loadTodayChores();
  }, [loadTodayChores]);
  const doneChores = useMemo(
    () => chores.filter((chore) => isChoreCompleted(chore)).length,
    [chores],
  );
  const totalChores = chores.length;
  const openChores = totalChores - doneChores;
  const progress = totalChores ? Math.round((doneChores / totalChores) * 100) : 0;

  const resetAddChore = useCallback(() => {
    setShowAddModal(false);
    setNewTitle("");
    setNewType("close_on_done");
    const todayKey = getHouseholdTodayKey(timeZone);
    setNewDate(todayKey);
    setNewRepeat("none");
    setNewEndDate(todayKey);
    setNewRepeatEnd(todayKey);
    setNewNotes("");
    setSubmitError(null);
    setFieldErrors({});
  }, [timeZone]);

  const submitAddChore = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      setFieldErrors({});
      setSubmitting(true);
      const payload = {
        action: "create",
        title: newTitle,
        type: newType,
        startDate: newDate,
        endDate: newEndDate,
        repeatRule: newRepeat,
        seriesEndDate: newRepeat !== "none" ? newRepeatEnd : null,
        notes: newNotes,
      };

      try {
        const response = await fetch("/api/chores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data?.error === "Household required") {
          window.location.assign("/household/setup");
          return;
        }
        if (!data?.ok) {
          if (data?.fieldErrors) {
            setFieldErrors(data.fieldErrors);
            setSubmitError(data.error ?? "Validation failed");
            setSubmitting(false);
            return;
          }
          throw new Error(data?.error ?? "Failed to create chore");
        }
        resetAddChore();
        await loadChores({ force: true });
        await loadTodayChores();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create chore";
        setSubmitError(message);
      }
      setSubmitting(false);
    },
    [
      loadChores,
      loadTodayChores,
      newDate,
      newEndDate,
      newRepeat,
      newRepeatEnd,
      newTitle,
      newType,
      newNotes,
      resetAddChore,
    ],
  );

  const markChoreDone = async (targetChore: ChoreItem) => {
    const choreId = targetChore.id;
    const occurrenceDate = targetChore.occurrence_date;
    const optimisticStatus = targetChore.type === "stay_open" ? "open" : "closed";
    const undoUntil = DateTime.utc().plus({ seconds: 5 }).toISO();
    const previous = chores.find(
      (chore) => chore.id === choreId && chore.occurrence_date === occurrenceDate,
    );
    setChores((prev) =>
      prev.map((chore) =>
        chore.id === choreId && chore.occurrence_date === occurrenceDate
          ? {
              ...chore,
              status: optimisticStatus,
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
      if (data?.error === "Household required") {
        window.location.assign("/household/setup");
        return;
      }
      if (!data?.ok) {
        throw new Error(data?.error ?? "Failed to update chore");
      }
      if (data.undo_until) {
        setChores((prev) =>
          prev.map((chore) =>
            chore.id === choreId && chore.occurrence_date === occurrenceDate
              ? {
                  ...chore,
                  status: typeof data.status === "string" ? data.status : optimisticStatus,
                  closed_reason:
                    typeof data.closed_reason === "string" ? data.closed_reason : "done",
                  undo_until: data.undo_until,
                  can_undo: true,
                }
              : chore,
          ),
        );
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
    } finally {
      await loadTodayChores();
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
      if (data?.error === "Household required") {
        window.location.assign("/household/setup");
        return;
      }
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
    } finally {
      await loadTodayChores();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,_var(--glow-1),_transparent_55%),radial-gradient(circle_at_85%_5%,_var(--glow-3),_transparent_45%),linear-gradient(180deg,_var(--glow-2),_transparent_45%)]" />
      <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 pb-10 pt-8 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
                  The Sweep Heap
                </span>
                <h1 className="text-3xl font-semibold tracking-tight">Weekly Choreboard</h1>
              </div>
              <SignOutButton />
            </div>
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
                onClick={() => {
                  setSubmitError(null);
                  setNewType("close_on_done");
                  setShowAddModal(true);
                }}
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
              {loadingToday ? (
                <div className="text-xs text-[var(--muted)]">Loading chores...</div>
              ) : todayChores.length ? (
                <>
                  {todayChores.slice(0, 3).map((chore) => (
                    <div
                      key={`${chore.id}-${chore.occurrence_date}-today`}
                      className="flex items-center justify-between rounded-xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-3 py-2 text-xs font-semibold"
                    >
                      <div className="flex flex-col gap-1">
                        <span
                          className={
                            isChoreCompleted(chore) && chore.type === "close_on_done"
                              ? "text-[var(--muted)] line-through"
                              : ""
                          }
                        >
                          {chore.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1">
                            <StateIcon className="h-3 w-3" chore={chore} />
                            {getChoreStateLabel(chore)}
                          </span>
                        </div>
                      </div>
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
            <div className="overflow-x-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface-weak)]">
              <div className="grid min-w-[980px] grid-cols-7 gap-0 divide-x divide-[var(--stroke)] bg-[linear-gradient(180deg,_var(--grid-line)_1px,_transparent_1px)] [background-size:100%_64px]">
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
                            {dayChores.map((chore) => {
                              const completed = isChoreCompleted(chore);
                              const isClosed = chore.status === "closed";
                              const showLineThrough = completed && chore.type === "close_on_done";
                              const isLogged = completed && chore.type === "stay_open";
                              return (
                                <button
                                  key={`${chore.id}-${chore.occurrence_date}`}
                                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[0.7rem] font-semibold transition ${
                                    showLineThrough || isClosed
                                      ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--muted)]"
                                      : isLogged
                                        ? "border-[var(--accent-soft)] bg-[var(--surface-strong)] text-[var(--ink)]"
                                        : "border-[var(--stroke)] bg-[var(--card)] text-[var(--ink)] hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
                                  }`}
                                  onClick={() => {
                                    setSelectedChore(chore);
                                  }}
                                  type="button"
                                >
                                  <div className="flex min-w-0 flex-col gap-1">
                                    <span className={showLineThrough ? "line-through" : ""}>
                                      {chore.title}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
                                      <span className="inline-flex items-center gap-1">
                                        <StateIcon className="h-3 w-3" chore={chore} />
                                        {getChoreStateLabel(chore)}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--muted)]">No chores scheduled</div>
                        )}
                      </div>
                      <button
                        className="mt-3 rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setSubmitError(null);
                          setNewType("close_on_done");
                          setShowAddModal(true);
                          if (dayKey) {
                            setNewDate(dayKey);
                            setNewEndDate(dayKey);
                            setNewRepeatEnd(dayKey);
                          }
                        }}
                        disabled={day < today}
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
                    <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                      <StateIcon
                        chore={{
                          type: toast.type,
                          status: "open",
                          closed_reason: "done",
                        }}
                        className="h-3 w-3"
                      />
                      {toast.type === "stay_open" ? "Logged completion" : "Marked done"}
                    </span>
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
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowAddModal(false)}
            type="button"
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold">Add a chore</h3>
                <p className="text-xs text-[var(--muted)]">
                  Quick details now, schedule tweaks later.
                </p>
              </div>
            </div>
            <form className="flex flex-col gap-4 px-6 py-5" onSubmit={submitAddChore}>
              {submitError ? (
                <div className="rounded-2xl border border-[var(--danger-stroke)] bg-[var(--danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--danger-ink)]">
                  {submitError}
                </div>
              ) : null}
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Title
                <input
                  className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                    fieldErrors.title
                      ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                      : "border-[var(--stroke)]"
                  }`}
                  placeholder="Laundry, dishes, vacuum"
                  required
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                />
                {fieldErrors.title ? (
                  <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                    {fieldErrors.title}
                  </span>
                ) : null}
              </label>
              <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Chore type
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
                      newType === "close_on_done"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--stroke)] bg-[var(--card)]"
                    }`}
                  >
                    <input
                      checked={newType === "close_on_done"}
                      className="sr-only"
                      name="chore-type"
                      onChange={() => setNewType("close_on_done")}
                      type="radio"
                      value="close_on_done"
                    />
                    <div className="text-sm font-semibold normal-case tracking-normal text-[var(--ink)]">
                      Close on done
                    </div>
                    <div className="mt-1 text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--muted)]">
                      Marking done closes the task for this day.
                    </div>
                  </label>
                  <label
                    className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
                      newType === "stay_open"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--stroke)] bg-[var(--card)]"
                    }`}
                  >
                    <input
                      checked={newType === "stay_open"}
                      className="sr-only"
                      name="chore-type"
                      onChange={() => setNewType("stay_open")}
                      type="radio"
                      value="stay_open"
                    />
                    <div className="text-sm font-semibold normal-case tracking-normal text-[var(--ink)]">
                      Stays open
                    </div>
                    <div className="mt-1 text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--muted)]">
                      Marking done logs progress but keeps it visible.
                    </div>
                  </label>
                </div>
                {fieldErrors.type ? (
                  <span className="text-[0.65rem] font-semibold normal-case tracking-normal text-[var(--danger-ink)]">
                    {fieldErrors.type}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Start date
                  <input
                    className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                      fieldErrors.startDate
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : "border-[var(--stroke)]"
                    }`}
                    type="date"
                    value={newDate}
                    onChange={(event) => setNewDate(event.target.value)}
                  />
                  {fieldErrors.startDate ? (
                    <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                      {fieldErrors.startDate}
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  End date
                  <input
                    className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                      fieldErrors.endDate
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : "border-[var(--stroke)]"
                    }`}
                    type="date"
                    value={newEndDate}
                    onChange={(event) => setNewEndDate(event.target.value)}
                  />
                  {fieldErrors.endDate ? (
                    <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                      {fieldErrors.endDate}
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Repeat
                  <select
                    className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                      fieldErrors.repeatRule
                        ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                        : "border-[var(--stroke)]"
                    }`}
                    value={newRepeat}
                    onChange={(event) => setNewRepeat(event.target.value)}
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  {fieldErrors.repeatRule ? (
                    <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                      {fieldErrors.repeatRule}
                    </span>
                  ) : null}
                </label>
                {newRepeat !== "none" ? (
                  <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Repeat ends
                    <input
                      className={`rounded-xl border bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)] ${
                        fieldErrors.repeatEnd
                          ? "border-[var(--danger)] ring-1 ring-[var(--danger)]"
                          : "border-[var(--stroke)]"
                      }`}
                      type="date"
                      value={newRepeatEnd}
                      onChange={(event) => setNewRepeatEnd(event.target.value)}
                    />
                    {fieldErrors.repeatEnd ? (
                      <span className="text-[0.65rem] font-semibold text-[var(--danger-ink)]">
                        {fieldErrors.repeatEnd}
                      </span>
                    ) : null}
                  </label>
                ) : null}
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Notes
                <textarea
                  className="min-h-[90px] resize-none rounded-xl border border-[var(--stroke)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                  placeholder="Supplies, preferences, reminders"
                  value={newNotes}
                  onChange={(event) => setNewNotes(event.target.value)}
                />
              </label>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke)] pt-4">
                <button
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
                  onClick={resetAddChore}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Saving..." : "Save chore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {selectedChore ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedChore(null)}
            type="button"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="border-b border-[var(--stroke)] bg-[var(--surface-weak)] px-6 py-5">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Chore</div>
              <h3 className="text-xl font-semibold">{selectedChore.title}</h3>
              <p className="text-xs text-[var(--muted)]">
                {DateTime.fromISO(selectedChore.occurrence_date).toFormat("cccc, LLL d")}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                <TypeIcon className="h-3.5 w-3.5" type={selectedChore.type} />
                {getChoreTypeLabel(selectedChore.type)}
              </span>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold">
                <span className="text-[var(--muted)]">Status</span>
                <span className="inline-flex items-center gap-1">
                  <StateIcon chore={selectedChore} className="h-3.5 w-3.5" />
                  {getChoreStateLabel(selectedChore)}
                </span>
              </div>
              {selectedChore.notes ? (
                <div className="rounded-2xl border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-4 py-3 text-xs font-semibold">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Notes
                  </div>
                  <div className="mt-2 text-sm text-[var(--ink)]">{selectedChore.notes}</div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPrimaryActionDisabled({
                    chore: selectedChore,
                    todayKey: todayKey ?? "",
                  })}
                  onClick={() => {
                    markChoreDone(selectedChore);
                    setSelectedChore(null);
                  }}
                  type="button"
                >
                  {getPrimaryActionLabel(selectedChore)}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={selectedChore.occurrence_date < (todayKey ?? "")}
                    type="button"
                  >
                    Skip
                  </button>
                  <button
                    className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={selectedChore.occurrence_date < (todayKey ?? "")}
                    type="button"
                  >
                    Snooze
                  </button>
                </div>
                <button
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setSelectedChore(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
