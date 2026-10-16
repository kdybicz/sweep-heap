ALTER TABLE "chores" ADD COLUMN "recurrence_anchor_day" integer;
--> statement-breakpoint
-- Stop old-version writers before applying this migration. Preserve sparse exception identity by
-- calendar ordinal while correcting legacy iterative clamping. Each valid monthly key stays in its
-- own month; each yearly key stays in its own year. Orphan/unsupported keys are left for audit.
-- A collision with another existing key fails the transaction rather than overwriting either state.
WITH candidates AS (
  SELECT e.id, e.occurrence_start_date, c.start_date, c.repeat_rule,
    EXTRACT(DAY FROM c.start_date)::integer AS anchor_day,
    DATE_TRUNC('month', e.occurrence_start_date)::date AS target_month,
    ((EXTRACT(YEAR FROM e.occurrence_start_date)::integer - EXTRACT(YEAR FROM c.start_date)::integer) * 12
      + EXTRACT(MONTH FROM e.occurrence_start_date)::integer - EXTRACT(MONTH FROM c.start_date)::integer) AS months_elapsed
  FROM chore_occurrence_exceptions e JOIN chores c ON c.id = e.chore_id
  WHERE c.repeat_rule IN ('month', 'year')
    AND c.start_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
    AND e.occurrence_start_date BETWEEN c.start_date AND DATE '9999-12-31'
    AND EXTRACT(DAY FROM c.start_date) > 28
    AND (c.repeat_rule = 'month' OR EXTRACT(MONTH FROM e.occurrence_start_date) = EXTRACT(MONTH FROM c.start_date))
), dates AS (
  SELECT id, occurrence_start_date,
    target_month + (LEAST(anchor_day, EXTRACT(DAY FROM target_month + INTERVAL '1 month - 1 day')::integer) - 1) AS anchored_date,
    target_month + (CASE WHEN repeat_rule = 'month' THEN
      -- Within 24 monthly steps every origin has encountered a common-year February. No scan
      -- proportional to series age is needed to recover the minimum day reached by old stepping.
      LEAST(anchor_day, COALESCE((
        SELECT MIN(EXTRACT(DAY FROM DATE_TRUNC('month', start_date) + MAKE_INTERVAL(months => step + 1) - INTERVAL '1 day'))::integer
        FROM GENERATE_SERIES(1, LEAST(months_elapsed, 24)) AS step
      ), anchor_day))
    WHEN EXTRACT(MONTH FROM start_date) = 2 AND months_elapsed > 0 THEN 28
    ELSE anchor_day END - 1) AS legacy_date
  FROM candidates
)
UPDATE chore_occurrence_exceptions e
SET occurrence_start_date = dates.anchored_date
FROM dates
WHERE e.id = dates.id AND dates.occurrence_start_date = dates.legacy_date
  AND dates.anchored_date <> dates.occurrence_start_date;
