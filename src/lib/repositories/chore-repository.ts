import { pool } from "@/lib/db";

type ChoreSeriesRow = {
  id: number;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  series_end_date: string | null;
  repeat_rule: string;
  status: string;
  notes: string | null;
};

type ChoreOverrideRow = {
  chore_id: number;
  occurrence_start_date: string;
  status: string;
  closed_reason: string | null;
  undo_until: Date | null;
};

type ChoreExclusionRow = {
  chore_id: number;
  occurrence_start_date: string;
};

type ChoreOverrideRecord = {
  status: string;
  closedReason: string | null;
  undoUntil: Date | null;
};

type ChoreInHouseholdRow = {
  id: number;
  type: "close_on_done" | "stay_open";
  start_date: string;
  end_date: string;
  series_end_date: string | null;
  repeat_rule: string;
};

type HouseholdDateRange = {
  householdId: number;
  rangeStart: string;
  rangeEnd: string;
};

export const listActiveChoreSeriesByHousehold = async ({
  householdId,
  rangeStart,
  rangeEnd,
}: HouseholdDateRange) => {
  const result = await pool.query<ChoreSeriesRow>(
    "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, repeat_rule, status, notes from chores where status = 'active' and household_id = $1 and start_date <= $3::date and (coalesce(series_end_date, $3::date) + (end_date - start_date - 1)) >= $2::date",
    [householdId, rangeStart, rangeEnd],
  );
  return result.rows;
};

export const listChoreOverridesByHousehold = async ({
  householdId,
  rangeStart,
  rangeEnd,
}: HouseholdDateRange) => {
  const result = await pool.query<ChoreOverrideRow>(
    "select o.chore_id, to_char(o.occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date, o.status, o.closed_reason, o.undo_until from chore_occurrence_overrides o join chores c on c.id = o.chore_id where c.household_id = $1 and c.status = 'active' and o.occurrence_start_date <= $3::date and (o.occurrence_start_date + (c.end_date - c.start_date - 1)) >= $2::date",
    [householdId, rangeStart, rangeEnd],
  );
  return result.rows;
};

export const listChoreExclusionsByHousehold = async ({
  householdId,
  rangeStart,
  rangeEnd,
}: HouseholdDateRange) => {
  const result = await pool.query<ChoreExclusionRow>(
    "select e.chore_id, to_char(e.occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date from chore_occurrence_exclusions e join chores c on c.id = e.chore_id where c.household_id = $1 and c.status = 'active' and e.occurrence_start_date <= $3::date and (e.occurrence_start_date + (c.end_date - c.start_date - 1)) >= $2::date",
    [householdId, rangeStart, rangeEnd],
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
}: {
  householdId: number;
  title: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  seriesEndDate: string | null;
  repeatRule: string;
  notes: string | null;
}) => {
  const result = await pool.query<{ id: number }>(
    "insert into chores (household_id, title, type, start_date, end_date, series_end_date, repeat_rule, status, notes) values ($1, $2, $3, $4, $5, $6, $7, 'active', $8) returning id",
    [householdId, title, type, startDate, endDate, seriesEndDate, repeatRule, notes],
  );
  return result.rows[0]?.id ?? null;
};

export const getChoreInHousehold = async ({
  choreId,
  householdId,
}: {
  choreId: number;
  householdId: number;
}) => {
  const result = await pool.query<ChoreInHouseholdRow>(
    "select id, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, repeat_rule from chores where id = $1 and household_id = $2",
    [choreId, householdId],
  );
  return result.rows[0] ?? null;
};

export const getChoreOccurrenceOverride = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  const result = await pool.query<ChoreOverrideRecord>(
    'select status, closed_reason as "closedReason", undo_until as "undoUntil" from chore_occurrence_overrides where chore_id = $1 and occurrence_start_date = $2 limit 1',
    [choreId, occurrenceStartDate],
  );
  return result.rows[0] ?? null;
};

export const deleteChoreOccurrenceOverride = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  await pool.query(
    "delete from chore_occurrence_overrides where chore_id = $1 and occurrence_start_date = $2",
    [choreId, occurrenceStartDate],
  );
};

export const upsertChoreOccurrenceOverride = async ({
  choreId,
  occurrenceStartDate,
  status,
  closedReason,
  undoUntil,
}: {
  choreId: number;
  occurrenceStartDate: string;
  status: "open" | "closed";
  closedReason: "done" | null;
  undoUntil: string | null;
}) => {
  await pool.query(
    "insert into chore_occurrence_overrides (chore_id, occurrence_start_date, status, closed_reason, undo_until) values ($1, $2, $3, $4, $5) on conflict (chore_id, occurrence_start_date) do update set status = excluded.status, closed_reason = excluded.closed_reason, undo_until = excluded.undo_until, updated_at = now()",
    [choreId, occurrenceStartDate, status, closedReason, undoUntil],
  );
};

export const getChoreOccurrenceExclusion = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  const result = await pool.query<{ occurrence_start_date: string }>(
    "select to_char(occurrence_start_date, 'YYYY-MM-DD') as occurrence_start_date from chore_occurrence_exclusions where chore_id = $1 and occurrence_start_date = $2 limit 1",
    [choreId, occurrenceStartDate],
  );
  return result.rows[0] ?? null;
};

export const upsertChoreOccurrenceExclusion = async ({
  choreId,
  occurrenceStartDate,
}: {
  choreId: number;
  occurrenceStartDate: string;
}) => {
  await pool.query(
    "insert into chore_occurrence_exclusions (chore_id, occurrence_start_date) values ($1, $2) on conflict (chore_id, occurrence_start_date) do nothing",
    [choreId, occurrenceStartDate],
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
