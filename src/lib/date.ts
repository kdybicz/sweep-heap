import type { DateTime } from "luxon";

export const toISODateOrThrow = (value: DateTime) => {
  const date = value.toISODate();
  if (!date) {
    throw new Error("Invalid DateTime");
  }
  return date;
};
