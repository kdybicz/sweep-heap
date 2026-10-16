import { pool } from "@/lib/db";
import { listActiveChoreSeriesQuery } from "@/lib/repositories/chore-series-query";

type ChoreSeriesRow = {
  id: number;
  title: string;
  type: string;
  start_date: string;
  recurrence_anchor_day: number | null;
  end_date: string;
  series_end_date: string | null;
  repeat_rule: string;
  status: string;
  notes: string | null;
};

type ChoreExceptionRow = {
  chore_id: number;
  occurrence_start_date: string;
  kind: string;
  status: string | null;
  closed_reason: string | null;
};

type ChoreInHouseholdRow = {
  id: number;
  title: string;
  type: "close_on_done" | "stay_open";
  start_date: string;
  recurrence_anchor_day: number | null;
  end_date: string;
  series_end_date: string | null;
  repeat_rule: string;
  notes: string | null;
};

type HouseholdDateRange = {
  householdId: number;
  rangeStart: string;
  rangeEnd: string;
  maxResults?: number;
};

export const listActiveChoreSeriesByHousehold = async ({
  householdId,
  rangeStart,
  rangeEnd,
  maxResults,
}: HouseholdDateRange) => {
  const result = await pool.query<ChoreSeriesRow>(
    maxResults === undefined
      ? listActiveChoreSeriesQuery
      : `${listActiveChoreSeriesQuery} limit $4`,
    maxResults === undefined
      ? [householdId, rangeStart, rangeEnd]
      : [householdId, rangeStart, rangeEnd, maxResults],
  );
  return result.rows;
};

export const listChoreExceptionsByHousehold = async ({
  householdId,
  rangeStart,
  rangeEnd,
  maxResults,
}: HouseholdDateRange) => {
  const result = await pool.query<ChoreExceptionRow>(
    "select e.chore_id, to_char(e.occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date, e.kind, e.status, e.closed_reason from chore_occurrence_exceptions e join chores c on c.id = e.chore_id where c.household_id = $1 and c.status = 'active' and e.occurrence_start_date <= $3::date and (e.occurrence_start_date + (c.end_date - c.start_date - 1)) >= $2::date limit $4",
    [householdId, rangeStart, rangeEnd, maxResults ?? null],
  );
  return result.rows;
};

export const insertChore = async ({
  householdId,
  title,
  type,
  startDate,
  endDate,
  seriesEndDate,
  repeatRule,
  notes,
  recurrenceAnchorDay = null,
}: {
  householdId: number;
  title: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  seriesEndDate: string | null;
  repeatRule: string;
  notes: string | null;
  recurrenceAnchorDay?: number | null;
}) => {
  const result = await pool.query<{ id: number }>(
    "insert into chores (household_id, title, type, start_date, end_date, series_end_date, repeat_rule, status, notes, recurrence_anchor_day) values ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9) returning id",
    [
      householdId,
      title,
      type,
      startDate,
      endDate,
      seriesEndDate,
      repeatRule,
      notes,
      recurrenceAnchorDay,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Chore insertion did not return an id");
  return id;
};

export const getChoreInHousehold = async ({
  choreId,
  householdId,
}: {
  choreId: number;
  householdId: number;
}) => {
  const result = await pool.query<ChoreInHouseholdRow>(
    "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, recurrence_anchor_day, repeat_rule, notes from chores where id = $1 and household_id = $2 and status = 'active'",
    [choreId, householdId],
  );
  return result.rows[0] ?? null;
};

export const getChoreOccurrenceException = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  const result = await pool.query<ChoreExceptionRow>(
    "select chore_id, to_char(occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date, kind, status, closed_reason from chore_occurrence_exceptions where chore_id = $1 and occurrence_start_date = $2 limit 1",
    [choreId, occurrenceStartDate],
  );
  return result.rows[0] ?? null;
};

export const deleteChoreOccurrenceException = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  await pool.query(
    "delete from chore_occurrence_exceptions where chore_id = $1 and occurrence_start_date = $2",
    [choreId, occurrenceStartDate],
  );
};

export const listChoreOccurrenceExceptions = async ({
  choreId,
  fromDate,
  maxResults,
}: {
  choreId: number;
  fromDate: string;
  maxResults?: number;
}) => {
  const result = await pool.query<ChoreExceptionRow>(
    "select chore_id, to_char(occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date, kind, status, closed_reason from chore_occurrence_exceptions where chore_id = $1 and occurrence_start_date >= $2::date order by occurrence_start_date limit $3",
    [choreId, fromDate, maxResults ?? null],
  );
  return result.rows;
};

export const deleteChoreOccurrenceExceptions = async ({
  choreId,
  fromDate,
}: {
  choreId: number;
  fromDate: string;
}) => {
  await pool.query(
    "delete from chore_occurrence_exceptions where chore_id = $1 and occurrence_start_date >= $2::date",
    [choreId, fromDate],
  );
};

export const upsertChoreOccurrenceException = async ({
  choreId,
  occurrenceStartDate,
  kind,
  status,
  closedReason,
}: {
  choreId: number;
  occurrenceStartDate: string;
  kind: "state" | "canceled";
  status: "open" | "closed" | null;
  closedReason: "done" | null;
}) => {
  await pool.query(
    "insert into chore_occurrence_exceptions (chore_id, occurrence_start_date, kind, status, closed_reason) values ($1, $2, $3, $4, $5) on conflict (chore_id, occurrence_start_date) do update set kind = excluded.kind, status = excluded.status, closed_reason = excluded.closed_reason, updated_at = now()",
    [choreId, occurrenceStartDate, kind, status, closedReason],
  );
};

export const updateChoreSeriesEndDate = async ({
  choreId,
  seriesEndDate,
}: {
  choreId: number;
  seriesEndDate: string | null;
}) => {
  await pool.query("update chores set series_end_date = $2 where id = $1", [
    choreId,
    seriesEndDate,
  ]);
};

export const updateChoreStatus = async ({
  choreId,
  status,
}: {
  choreId: number;
  status: "active" | "canceled";
}) => {
  await pool.query("update chores set status = $2 where id = $1", [choreId, status]);
};

export const updateChoreSeries = async ({
  choreId,
  title,
  type,
  startDate,
  endDate,
  seriesEndDate,
  repeatRule,
  notes,
  recurrenceAnchorDay = null,
}: {
  choreId: number;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  seriesEndDate: string | null;
  repeatRule: string;
  notes: string | null;
  recurrenceAnchorDay?: number | null;
}) => {
  await pool.query(
    "update chores set title = $2, type = $3, start_date = $4, end_date = $5, series_end_date = $6, repeat_rule = $7, notes = $8, recurrence_anchor_day = $9 where id = $1",
    [
      choreId,
      title,
      type,
      startDate,
      endDate,
      seriesEndDate,
      repeatRule,
      notes,
      recurrenceAnchorDay,
    ],
  );
};
