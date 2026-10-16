# Original-anchor calendar recurrence

Monthly patterns use their original day of month. Missing days clamp only that period: a Jan 31
origin produces Feb 28/29, Mar 31 and Apr 30. An Apr 30 origin produces May 30, not May 31.
Yearly Feb 29 patterns use Feb 28 in common years and restore Feb 29 in leap years; 2100 is common,
2400 is leap. Duration stays an exclusive civil-day span, and repeat cutoffs remain inclusive,
absolute occurrence-start dates.

Generation, occurrence-start validation and edit exception mapping share the same calendar stepping
and request budgets. Calendar seeking remains iterative and may hit the 50,000-step limit for very
old series; fixed day/week/biweek seeking is unchanged.

## Edit scopes and anchor metadata

`chores.recurrence_anchor_day` is nullable integer metadata (days 1–31). Null derives the day from
`start_date`; new ordinary series use that default. A following edit at a clamped date inherits the
source's day when its effective start and cadence are unchanged. Splitting Jan 31 at Feb 28 for a
notes/duration change therefore still produces Mar 31. Whole-series edits retain an inherited day
under the same rule, including occurrence-relative edits with no effective start shift.

A changed effective start or cadence establishes a new day from the resulting start. This applies
to an explicitly selected date as well as a cadence change with default dates. Single edits create
a one-off and cancel only the selected original instance. Sparse completion/cancellation exceptions
continue to map by ordinal within all/following scope; canceled instances still consume an ordinal.

Pre-upgrade split branches use their own stored start as their original anchor: old storage has no
parent/anchor lineage from which to reconstruct a lost 31st/leap-day preference.

## Deployment migration and identity policy

`drizzle/0001_polite_korvac.sql` adds the metadata column and corrects legacy exception keys in the
same migration transaction. For each supported month/year schedule it recognizes keys produced by
the old iterative-clamping sequence and moves them to the original-anchor occurrence in the same
month/year. Exception ids, kind, state, reason and creation/update timestamps stay unchanged.
The monthly legacy-day calculation examines at most 24 months per key: by then a common-year
February has permanently reduced the old sequence to at most day 28. It never scans the age of
the series. Non-calendar schedules, unrecognized orphan keys and years outside 0001–9999 are left
unchanged for the staged invariant audit in [#10](https://github.com/kdybicz/sweep-heap/issues/10).

Cutoffs do not move. An exception remapped beyond a finite cutoff is retained in storage but has
no generated occurrence within that cutoff. Later schedule edits use the ordinary source/target
cutoff policy. Keys from pre-upgrade detached one-offs remain on those independent chores.

### Rollout

1. Stop old app processes/writers before running `make db-migrate` (use `AGENT=1` in containers).
2. Apply the migration once through the Drizzle journal, then start the upgraded app. Do not run
   old and new recurrence writers concurrently: the same ordinal can now have a different date key.
3. Refresh already-open boards. Old drifted date identifiers receive the existing
   `409 OCCURRENCE_OUTSIDE_SCHEDULE`; there is no ambiguous old-key alias. Reload retrieves the
   anchored identifiers and migrated completion/cancellation state.

If a legacy key's target is already occupied by a different row, the existing unique constraint
aborts the entire migration. Neither completion nor cancellation wins implicitly; the schema and
all key changes roll back, and the migration is not recorded. Inspect the reported chore/date pair,
resolve that data ambiguity deliberately, then rerun the migration. Do not delete state to bypass
the error. A downgrade after a successful migration requires restoring pre-upgrade data as well as
old code; running old code directly against corrected exception keys is not compatible.

Live regressions execute the exact SQL against isolated table copies and verify a Gregorian-cycle
dataset plus collision rollback. The regular API regressions verify the new identities and scope
semantics after `make db-migrate`.
