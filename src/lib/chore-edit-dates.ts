import { DateTime } from "luxon";

/** Translate an occurrence's edited dates to stored series dates without re-anchoring on that instance. */
export const translateOccurrenceSeriesDates = ({
  seriesStartDate,
  occurrenceStartDate,
  startDate,
  exclusiveEndDate,
}: {
  seriesStartDate: string;
  occurrenceStartDate: string;
  startDate: string | null;
  exclusiveEndDate: string | null;
}):
  | { ok: true; startDate: string; exclusiveEndDate: string }
  | { ok: false; fieldErrors: Record<string, string> } => {
  const series = DateTime.fromISO(seriesStartDate, { zone: "UTC" }).startOf("day");
  const occurrence = DateTime.fromISO(occurrenceStartDate, { zone: "UTC" }).startOf("day");
  const start = DateTime.fromISO(startDate ?? "", { zone: "UTC" }).startOf("day");
  const end = DateTime.fromISO(exclusiveEndDate ?? "", { zone: "UTC" }).startOf("day");
  if (!series.isValid || !occurrence.isValid)
    throw new Error("Invalid stored chore schedule dates");
  const fieldErrors: Record<string, string> = {};
  if (!start.isValid) fieldErrors.startDate = "Invalid start date";
  if (!end.isValid) fieldErrors.endDate = "Invalid end date";
  if (start.isValid && end.isValid && end <= start)
    fieldErrors.endDate = "End date must be after start date";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  const delta = start.diff(occurrence, "days").days;
  const duration = end.diff(start, "days").days;
  const mappedStart = series.plus({ days: delta });
  const mappedEnd = mappedStart.plus({ days: duration });
  const nextStart = mappedStart.toISODate();
  const nextEnd = mappedEnd.toISODate();
  if (!nextStart || !nextEnd)
    return { ok: false, fieldErrors: { startDate: "Invalid translated series dates" } };
  return { ok: true, startDate: nextStart, exclusiveEndDate: nextEnd };
};
