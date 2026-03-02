import { DateTime as LuxonDateTime } from "luxon";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DayColumn from "@/app/heap/components/DayColumn";
import type { ChoreItem } from "@/app/heap/types";

const noop = () => undefined;

const buildProps = ({
  day,
  today,
  dayChores = [],
}: {
  day: ReturnType<typeof LuxonDateTime.fromISO>;
  today: ReturnType<typeof LuxonDateTime.fromISO>;
  dayChores?: ChoreItem[];
}) => ({
  day,
  dayKey: day.toISODate(),
  dayChores,
  loading: false,
  showLeftDivider: false,
  today,
  onSelectChore: noop,
  onAddChoreForDate: noop,
});

describe("DayColumn", () => {
  it("renders a circular highlight for the current day number", () => {
    const today = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ day: today, today })} />);

    expect(markup).toContain(
      "h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white",
    );
    expect(markup).toContain(">2</span>");
  });

  it("does not highlight day number when day is not current date", () => {
    const today = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });
    const day = LuxonDateTime.fromISO("2026-03-03", { zone: "UTC" });
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ day, today })} />);

    expect(markup).not.toContain(
      "h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white",
    );
    expect(markup).toContain(">3</span>");
  });

  it("disables add chore for days before today", () => {
    const today = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });
    const day = LuxonDateTime.fromISO("2026-03-01", { zone: "UTC" });
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ day, today })} />);

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Add chore<\/button>/);
  });

  it("keeps add chore enabled for today", () => {
    const today = LuxonDateTime.fromISO("2026-03-02", { zone: "UTC" });
    const markup = renderToStaticMarkup(<DayColumn {...buildProps({ day: today, today })} />);

    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Add chore<\/button>/);
  });
});
