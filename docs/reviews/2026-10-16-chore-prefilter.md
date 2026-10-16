# Chore series prefilter query plans

Issue [#29](https://github.com/kdybicz/sweep-heap/issues/29) fixes historical one-offs being selected by SQL and discarded later during occurrence generation. In the fixture below, the fixed predicate reduces SQL output from 20,005 series to the 5 eligible series.

## Predicate

The existing household, active-status, start-date and recurrence-cutoff predicates remain in place. The additional guard is:

```sql
and (repeat_rule <> 'none' or end_date > $2::date)
```

`$2` is the inclusive query start. A one-off ending exactly there does not overlap because its `end_date` is exclusive. A repeating origin can end before the query starts and still produce later occurrences, so this guard does not constrain repeating series by their original end date.

The production statement lives in `src/lib/repositories/chore-series-query.ts`. The repository and live regressions import that same statement. The plan test retains a separate pre-#29 SQL snapshot for the comparison.

## Method and fixture

Captured on 2026-10-16 with PostgreSQL 16.15 and query parameters `[1, '2026-10-12', '2026-10-18']`.

- Create a transaction-local temporary copy of `public.chores` with its defaults, NOT NULL/check constraints and indexes. `LIKE` does not copy foreign keys; these single-table plans do not use them. The current schema has only its primary-key index.
- Insert explicit synthetic ids so the public serial sequence is not consumed.
- Populate 20,000 historical active one-offs in the target household, 80,000 historical active one-offs in another household, 20,000 canceled one-offs, and 5 eligible target series. The eligible cases include current/clipped one-offs and open-ended/finite repeating series.
- Run `ANALYZE`, prime each query once, then alternate three samples of the old and fixed queries with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF)`.
- Add the candidate partial household index only to the temporary copy, analyze again and collect three more samples. Roll back the transaction and release the connection.

This is database-plan evidence on a controlled temporary-table fixture. It excludes client transfer and JavaScript occurrence-generation time. Rows were inserted in household/status groups; buffer figures are local temporary-table buffers, not production shared-buffer measurements. Timings are recorded as evidence rather than asserted as performance thresholds in tests.

## Results

| Query and indexes | Plan | Actual output rows | Rows removed by filter | Root local blocks accessed | Execution times, ms | Median, ms |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| Old query, primary key only | Sequential scan | 20,005 | 100,000 | 1,696 | 28.577, 29.137, 29.449 | 29.137 |
| Fixed query, primary key only | Sequential scan | 5 | 120,000 | 1,696 | 15.596, 15.640, 15.719 | 15.640 |
| Fixed query, candidate active-household index | Bitmap heap/index scan | 5 | 20,000 | 305 | 3.172, 2.590, 2.735 | 2.735 |

Selected fields from the median samples:

```json
{
  "before": {
    "Plan": {
      "Node Type": "Seq Scan",
      "Actual Rows": 20005,
      "Rows Removed by Filter": 100000,
      "Local Hit Blocks": 0,
      "Local Read Blocks": 1696
    },
    "Execution Time": 29.137
  },
  "after": {
    "Plan": {
      "Node Type": "Seq Scan",
      "Actual Rows": 5,
      "Rows Removed by Filter": 120000,
      "Local Hit Blocks": 0,
      "Local Read Blocks": 1696
    },
    "Execution Time": 15.640
  },
  "candidateIndex": {
    "Plan": {
      "Node Type": "Bitmap Heap Scan",
      "Actual Rows": 5,
      "Rows Removed by Filter": 20000,
      "Exact Heap Blocks": 287,
      "Local Hit Blocks": 305,
      "Local Read Blocks": 0
    },
    "Execution Time": 2.735
  }
}
```

The predicate removes all 20,000 historical target one-offs before SQL projection/output and JavaScript date parsing. It does not remove the underlying sequential scan with the current index set.

## Index assessment

The tested candidate is:

```sql
create index issue29_active_household_candidate
on chores (household_id)
where status = 'active';
```

It lets the planner isolate the target household's active rows. In this fixture it visits 20,005 index entries and 287 heap blocks, then the fixed predicate removes the 20,000 historical one-offs. It reduces unrelated-household/canceled-row scan work, but does not replace the overlap predicate. This change deploys the predicate fix; the index above is an independently measured temporary experiment, not a schema migration.

## Reproduction and correctness coverage

Run the live regression target with PostgreSQL, Mailpit and Chromium configured as described in [`docs/e2e-testing.md`](../e2e-testing.md):

```bash
AGENT=1 make test/e2e/regressions
```

The `#29 before/after query plans` test writes and attaches `issue29-query-plans.json` under `.e2e/test-results/regressions/`. It contains both SQL statements, fixture metadata, existing indexes and all nine complete JSON plans. Each rerun replaces its workspace report; the table above records the captured run.

The separate SQL/API overlap regression verifies historical one-offs, the exclusive left boundary, the inclusive right query boundary, spans clipped at either edge, finite-repeat cutoffs, every supported recurring cadence, canceled series and household isolation. It asserts selected SQL series ids before comparing generated API occurrences, so a final empty response cannot hide an over-broad SQL selection.
