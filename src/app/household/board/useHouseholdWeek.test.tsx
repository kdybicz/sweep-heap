// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHouseholdWeek from "@/app/household/board/useHouseholdWeek";
import type { UseHouseholdWeekModel } from "@/app/household/board/useHouseholdWeek.types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let model: UseHouseholdWeekModel;
let root: Root | undefined;
const Harness = () => {
  model = useHouseholdWeek();
  return null;
};
const mount = async () => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<Harness />));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T23:59:00Z"));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("household date and week lifecycle", () => {
  it("advances Today and the following-current-week range at local midnight", async () => {
    await mount();
    expect(model.todayKey).toBe("2026-10-11");
    expect(model.weekStartKey).toBe("2026-10-05");
    const revision = model.refreshVersion;
    await act(async () => vi.advanceTimersByTime(120000));
    expect(model.todayKey).toBe("2026-10-12");
    expect(model.weekStartKey).toBe("2026-10-12");
    expect(model.weekEndKey).toBe("2026-10-18");
    expect(model.refreshVersion).toBeGreaterThan(revision);
  });

  it("keeps a deliberately selected week pinned until Today is clicked", async () => {
    await mount();
    await act(async () => model.onPreviousWeek());
    expect(model.weekStartKey).toBe("2026-09-28");
    await act(async () => vi.advanceTimersByTime(120000));
    expect(model.todayKey).toBe("2026-10-12");
    expect(model.weekStartKey).toBe("2026-09-28");
    await act(async () => model.onNextWeek());
    expect(model.weekStartKey).toBe("2026-10-05");
    await act(async () => model.onResetWeek());
    expect(model.weekStartKey).toBe("2026-10-12");
  });

  it("catches up missed days on focus and refreshes again on same-day focus", async () => {
    await mount();
    vi.setSystemTime(new Date("2026-10-29T15:00:00Z"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(model.todayKey).toBe("2026-10-29");
    expect(model.weekStartKey).toBe("2026-10-26");
    const revision = model.refreshVersion;
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(model.refreshVersion).toBe(revision + 1);
    await act(async () => vi.advanceTimersByTime(9 * 60 * 60 * 1000));
    expect(model.todayKey).toBe("2026-10-30");
  });

  it("refreshes when visible after suspension, but not when the tab is hidden", async () => {
    await mount();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const revision = model.refreshVersion;
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(model.todayKey).toBe("2026-10-11");
    expect(model.refreshVersion).toBe(revision);
    visibility.mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(model.todayKey).toBe("2026-10-14");
  });

  it.each([
    ["2026-03-08T05:00:00Z", "2026-03-08", 23],
    ["2026-11-01T04:00:00Z", "2026-11-01", 25],
  ])("reschedules timezone changes for a %s DST day", async (instant, localDate, hours) => {
    vi.setSystemTime(new Date(instant));
    await mount();
    await act(async () => model.setTimeZone("America/New_York"));
    expect(model.todayKey).toBe(localDate);
    await act(async () => vi.advanceTimersByTime(hours * 60 * 60 * 1000 - 1));
    expect(model.todayKey).toBe(localDate);
    await act(async () => vi.advanceTimersByTime(1));
    expect(model.todayKey).not.toBe(localDate);
    expect(model.today.hour).toBe(0);
  });

  it("cleans up timers and resumption listeners on unmount", async () => {
    await mount();
    expect(vi.getTimerCount()).toBe(1);
    const revision = model.refreshVersion;
    await act(async () => root?.unmount());
    root = undefined;
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(model.refreshVersion).toBe(revision);
  });
});
