# Recurrence range-jump evidence

Issue [#30](https://github.com/kdybicz/sweep-heap/issues/30) replaces the origin-to-range scan for daily, weekly and biweekly series. In the captured 26-year daily case, a one-week generation probe drops from 37.653 ms to 0.531 ms, and occurrence-start validation drops from 36.853 ms to 0.283 ms.

## Algorithm and scope

For interval `p = 1, 7 or 14` calendar days:

```text
earliest = max(origin, rangeStart) - (durationDays - 1)
skip     = max(0, floor(calendarDaysBetween(origin, earliest) / p))
cursor   = origin + skip * p days
```

Starting at the duration-adjusted lower bound retains occurrences that start before the requested range but still overlap it. The cursor preserves the origin's phase rather than aligning to a weekday or query boundary. The existing inclusive `seriesEndDate` cutoff limits occurrence starts; the final occurrence may continue beyond it.

Within each overlapping occurrence, generation calculates the first and last visible day offsets. A narrow query does not walk every hidden day of a long span. Work depends on visible occurrences/day entries and their necessary overlap lookbehind, rather than the number of historical recurrence intervals.

`isOccurrenceStartInSeries()` is shared by the service and benchmark. At this report's capture, it used the same generator for a single-date range and checked occurrence-start identity. The subsequent [#31](https://github.com/kdybicz/sweep-heap/issues/31) validation work replaced span expansion with direct start-membership checks and bounded calendar stepping. Reruns use the current helper; the timings below preserve the #30 capture.

Month/year steps retain their iterative calendar clamping. Original-anchor corrections remain tracked in [#34](https://github.com/kdybicz/sweep-heap/issues/34). This change does not optimize the separate ordinal-migration walk in `mapOccurrenceStarts()`.

## Civil dates and DST

The generator now performs arithmetic in UTC **as a civil-date coordinate system**. It keeps literal date-only inputs; timestamp inputs first resolve to the household-local date. Household timezone still determines Today and the local date of a timestamp.

This also corrects an existing wall-clock drift bug. A local cursor can normalize a skipped midnight to 1 AM and then retain that hour indefinitely. In the pre-change probe for a daily series starting `2000-01-01`, with one-day duration and requested dates `2026-10-16` through `2026-10-18`, Havana and Apia returned only October 16 and 17. The final date was filtered out by a comparison against midnight. Civil-date stepping returns all three dates and keeps fixed-interval phase stable across historical midnight/date-line changes.

Those exceptional-zone fixes are intentional date-only corrections. Ordinary DST outputs are compared directly against the pre-change household-zone generator. Havana/Apia date-only outputs are compared against the pre-change **UTC calendar** sequence, rather than requiring the old shifted-hour behavior.

## Correctness and complexity checks

- A frozen pre-#30 generator in `e2e/legacy-occurrences.ts` provides an independent stepping oracle and benchmark baseline. App code does not import it.
- Default unit tests make 1,536 fixed-interval comparisons across UTC, New York, Warsaw and Kolkata; spring/autumn windows; aligned and off-phase origins; future origins; 1/3/9/17-day spans; and series cutoffs before, inside and at the query boundary.
- Other cases cover invalid dates/zones, timestamp-to-local-date conversion, Havana/Apia midnight history, current month/year clamping, and start validation versus an overlapping non-start day.
- Operation-count tests keep the visible work equal across aligned origins 364, 9,464 and 27,300 days earlier, roughly 1/26/75 years. Generation must use fewer than 80 `DateTime.plus()` calls, with at most a two-call difference across ages; single-date validation must use fewer than 25 calls. These are structural bounds, not elapsed-time thresholds.
- A 250-day daily span queried for one day returns its 250 overlapping identities with a date-operation budget proportional to those entries. A one-week query inside a century-long one-off emits only its seven visible days with fewer than 80 date additions.
- Live API cases list and complete old daily/weekly/biweekly series, retain final overlapping spans, reject off-schedule and post-cutoff starts, and exercise old Havana/Apia series through household-aware listing and UTC-key validation.

## Benchmark method

Captured on 2026-10-16 with Node v24.22.0. This is a Node/Luxon CPU probe, excluding database, HTTP, authorization and transaction-lock time.

- Query `2026-10-12` through `2026-10-18`, in UTC, with one-day duration and no series cutoff.
- Set the origin to the same calendar date 1, 10, 26 or 75 years earlier, for each fixed repeat rule.
- For validation, check the nearest scheduled start on or before the query start, using the production validation helper. The baseline uses the old generator and its original `.some()` start-identity check.
- Prime each function once, then alternate three timed baseline/optimized samples. Check output equality for each pair. Record all inputs, results and samples in the JSON attachment.
- Timing samples fluctuate with JIT, garbage collection and scheduling; operation-count tests enforce age-independent work. The benchmark does not assert a latency or speedup threshold.

## Captured medians

All times are milliseconds, rounded to three decimals.

| Rule | Age, years | Generation before | Generation after | Validation before | Validation after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Daily | 1 | 12.530 | 3.117 | 11.832 | 1.004 |
| Daily | 10 | 47.516 | 2.566 | 14.847 | 0.296 |
| Daily | 26 | 37.653 | 0.531 | 36.853 | 0.283 |
| Daily | 75 | 138.041 | 1.078 | 111.421 | 0.203 |
| Weekly | 1 | 1.211 | 0.442 | 0.981 | 0.362 |
| Weekly | 10 | 2.646 | 0.243 | 2.743 | 0.165 |
| Weekly | 26 | 6.167 | 0.191 | 6.089 | 0.186 |
| Weekly | 75 | 19.310 | 0.230 | 17.341 | 0.269 |
| Biweekly | 1 | 0.183 | 0.086 | 0.229 | 0.116 |
| Biweekly | 10 | 1.123 | 0.133 | 1.055 | 0.125 |
| Biweekly | 26 | 2.586 | 0.111 | 2.563 | 0.130 |
| Biweekly | 75 | 7.823 | 0.185 | 7.802 | 0.157 |

Daily generation emits seven entries; weekly emits one. Depending on phase, a biweekly series emits zero or one entry in this one-week window. Every validation probe checks a valid scheduled start. The operation-count tests use deliberately aligned origins so their output workload is identical at each age.

## Reproduction

Run the live regression target with the stack described in [`docs/e2e-testing.md`](../e2e-testing.md):

```bash
AGENT=1 make test/e2e/regressions
```

The `#30 records range and occurrence-validation benchmarks across series ages` test writes and attaches `issue30-recurrence-benchmark.json` under `.e2e/test-results/regressions/`. It contains all 24 rule/age/path measurements and their six timing samples. Reruns replace that workspace artifact; the table above preserves the captured run.
