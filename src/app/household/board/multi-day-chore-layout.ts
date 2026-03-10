import type { DateTime } from "luxon";
import { DateTime as LuxonDateTime } from "luxon";

import type { ChoreItem } from "@/app/household/board/types";

export type MultiDaySpan = {
  key: string;
  chore: ChoreItem;
  startCol: number;
  colSpan: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekGridLayout = {
  choreLanes: MultiDaySpan[][];
  occupiedDayKeys: Set<string>;
};

const getOccurrenceKey = (chore: ChoreItem) => `${chore.id}:${chore.occurrence_start_date}`;

const getOccurrenceEndDate = (startDate: string, durationDays: number) =>
  LuxonDateTime.fromISO(startDate, { zone: "UTC" })
    .plus({ days: durationDays - 1 })
    .toISODate();

const spansOverlap = (left: MultiDaySpan, right: MultiDaySpan) => {
  const leftEnd = left.startCol + left.colSpan - 1;
  const rightEnd = right.startCol + right.colSpan - 1;
  return left.startCol <= rightEnd && right.startCol <= leftEnd;
};

export const buildWeekGridLayout = ({
  chores,
  days,
  todayKey,
}: {
  chores: ChoreItem[];
  days: DateTime[];
  todayKey: string;
}): WeekGridLayout => {
  const dayKeys = days
    .map((day) => day.toISODate())
    .filter((dayKey): dayKey is string => Boolean(dayKey));
  const occurrenceGroups = new Map<string, ChoreItem[]>();

  for (const chore of chores) {
    const existing = occurrenceGroups.get(getOccurrenceKey(chore));
    if (existing) {
      existing.push(chore);
    } else {
      occurrenceGroups.set(getOccurrenceKey(chore), [chore]);
    }
  }

  const spans = Array.from(occurrenceGroups.entries())
    .map(([key, choresInGroup]) => {
      const sortedChores = choresInGroup
        .slice()
        .sort((left, right) => left.occurrence_date.localeCompare(right.occurrence_date));
      const visibleStartDate = sortedChores[0]?.occurrence_date ?? "";
      const visibleEndDate = sortedChores[sortedChores.length - 1]?.occurrence_date ?? "";
      const occurrenceStartDate = sortedChores[0]?.occurrence_start_date ?? visibleStartDate;
      const occurrenceEndDate = getOccurrenceEndDate(
        occurrenceStartDate,
        sortedChores[0]?.duration_days ?? 1,
      );
      const startCol = dayKeys.indexOf(visibleStartDate);
      const endCol = dayKeys.indexOf(visibleEndDate);

      if (startCol === -1 || endCol === -1) {
        return null;
      }

      const choreForToday = sortedChores.find((chore) => chore.occurrence_date === todayKey);

      return {
        key,
        chore: choreForToday ?? sortedChores[0],
        startCol,
        colSpan: endCol - startCol + 1,
        continuesBefore: visibleStartDate !== occurrenceStartDate,
        continuesAfter: visibleEndDate !== occurrenceEndDate,
      } satisfies MultiDaySpan;
    })
    .filter((span): span is MultiDaySpan => span !== null)
    .sort((left, right) => {
      if (left.startCol !== right.startCol) {
        return left.startCol - right.startCol;
      }
      return right.colSpan - left.colSpan;
    });

  const choreLanes: MultiDaySpan[][] = [];
  const occupiedDayKeys = new Set<string>();

  for (const span of spans) {
    for (let dayOffset = 0; dayOffset < span.colSpan; dayOffset += 1) {
      const dayKey = dayKeys[span.startCol + dayOffset];
      if (dayKey) {
        occupiedDayKeys.add(dayKey);
      }
    }

    let placed = false;

    for (const lane of choreLanes) {
      const overlaps = lane.some((candidate) => spansOverlap(candidate, span));

      if (!overlaps) {
        lane.push(span);
        placed = true;
        break;
      }
    }

    if (!placed) {
      choreLanes.push([span]);
    }
  }

  return {
    choreLanes,
    occupiedDayKeys,
  };
};
