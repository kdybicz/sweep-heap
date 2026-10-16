// Keep the prefilter shared with the live SQL overlap and query-plan regressions.
// A one-off's end is exclusive; a repeating series' original end is not its final occurrence end.
export const listActiveChoreSeriesQuery =
  "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, recurrence_anchor_day, repeat_rule, status, notes from chores where status = 'active' and household_id = $1 and start_date <= $3::date and (coalesce(series_end_date, $3::date) + (end_date - start_date - 1)) >= $2::date and (repeat_rule <> 'none' or end_date > $2::date)";
