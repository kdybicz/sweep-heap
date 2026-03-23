import { DateTime } from "luxon";

const toUtcDay = (value: string) => DateTime.fromISO(value, { zone: "UTC" }).startOf("day");

export const toInclusiveChoreEndDate = ({
  durationDays,
  startDate,
}: {
  durationDays: number;
  startDate: string;
}) => {
  const start = toUtcDay(startDate);
  if (!start.isValid) {
    return startDate;
  }

  return start.plus({ days: Math.max(durationDays, 1) - 1 }).toISODate() ?? startDate;
};

export const toExclusiveChoreEndDate = (inclusiveEndDate: string) => {
  const end = toUtcDay(inclusiveEndDate);
  if (!end.isValid) {
    return inclusiveEndDate;
  }

  return end.plus({ days: 1 }).toISODate() ?? inclusiveEndDate;
};

export const getStoredChoreDurationDays = ({
  exclusiveEndDate,
  startDate,
}: {
  exclusiveEndDate: string;
  startDate: string;
}) => {
  const start = toUtcDay(startDate);
  const exclusiveEnd = toUtcDay(exclusiveEndDate);
  if (!start.isValid || !exclusiveEnd.isValid) {
    return 1;
  }

  return Math.max(Math.round(exclusiveEnd.diff(start, "days").days), 1);
};
