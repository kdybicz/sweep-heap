# Chores - Requirements (V3 Draft)

## Status
- Active: V3 (fresh start).
- Scope: chores only. No users, households, points, or UI.

## Core concept
- A chore is scheduled like a Google Calendar all-day event.
- It has a start_date, end_date, and a repeat rule.
- Dates are calendar dates only (no time-of-day).
- All scheduling and display uses the Household time zone.

## Scheduling (MVP)
- start_date: first scheduled date (required).
- end_date: last scheduled date, inclusive (required; end_date >= start_date).
- repeat: none | day | week | month | year.
- Recurrence is anchored to start_date.
- Monthly/yearly repeats snap to the last day of the month if needed.
- Custom repeat rules are post-MVP (intervals, weekdays, etc.).

## Occurrence generation (MVP)
- A chore defines a series; each scheduled date in the series is a ChoreOccurrence.
- Occurrences are generated for every scheduled date between start_date and end_date (inclusive).
- For repeat=none, generate exactly one occurrence at start_date.
- For repeat=day, generate every calendar day.
- For repeat=week, generate every 7 days on the start_date weekday.
- For repeat=month, generate on the start_date day-of-month; if a month lacks that day, use the last day of that month.
- For repeat=year, generate on the start_date month/day; if missing (Feb 29), use Feb 28 in non-leap years.
- Occurrences can be generated lazily (on read) or precomputed; behavior must be identical.
- Occurrence_date is a date in the chore time zone (no time-of-day).

## Chore types
- close_on_done: marking done closes the occurrence and removes it from active lists.
- stay_open: marking done records a completion but the occurrence stays active/visible.

## Lifecycle rules
- A chore is active between start_date and end_date inclusive.
- When current_date (in the chore time zone) is past end_date, the chore closes.
- close_on_done chores close on the first completion of an occurrence.
- stay_open chores never close due to completion; only schedule end closes them.

## Data model (draft)
Household
- id
- name
- time_zone (IANA)
- created_at

Chore (series definition)
- id
- household_id
- name
- type: close_on_done | stay_open
- start_date (date)
- end_date (date; occurrence span end)
- series_end_date (date; last occurrence start date, inclusive; nullable for "no end")
- repeat_rule (enum above)
- time_zone (remove; derived from Household)
- status: active | closed
- closed_reason: schedule_end | manual
- created_at
- updated_at
- closed_at (timestamp, nullable)

ChoreOccurrence (derived per scheduled date)
- id
- chore_id
- occurrence_date (date)
- status: open | closed
- closed_reason: done | schedule_end
- last_completed_at (timestamp, optional)
- completed_count (int, optional; useful for stay_open)
- created_at

Completion (history)
- id
- chore_id
- occurrence_id
- completed_at (timestamp)
- actor_label (string, optional; placeholder for future ownership)

ChoreOccurrenceOverride (exceptions)
- id
- chore_id
- occurrence_date (date)
- status: open | closed
- closed_reason: done | schedule_end | manual
- updated_at

## Derived fields and indexes (draft)
- Chore.is_active is derived: current_date <= end_date AND status != closed.
- ChoreOccurrence.status is derived: if occurrence_date < current_date and not already closed, close_reason = schedule_end.
- Unique index on (chore_id, occurrence_date).
- Index on (chore_id, status) for active occurrence lookups.
- Index on (occurrence_date) for upcoming/overdue queries.

## Examples
Example A: One-off close_on_done
- start_date: 2026-03-10
- end_date: 2026-03-10
- repeat: none
- Result: one occurrence on 2026-03-10; closes when done.

Example B: Daily stay_open for a week
- start_date: 2026-03-01
- end_date: 2026-03-07
- repeat: day
- Result: 7 occurrences; each stays open for that day even after completion; all close after 2026-03-07.

Example C: Monthly on the 31st
- start_date: 2026-01-31
- end_date: 2026-04-30
- repeat: month
- Result: 2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30.

Example D: Yearly on Feb 29
- start_date: 2024-02-29
- end_date: 2026-02-28
- repeat: year
- Result: 2024-02-29, 2025-02-28, 2026-02-28.

## Edge cases (MVP)
- end_date before start_date is invalid.
- If a chore is manually closed, no future occurrences are active, even if within date range.
- If a close_on_done occurrence is completed, it closes immediately; future occurrences are unaffected.
- If current_date passes end_date, all open occurrences close with closed_reason=schedule_end.
- Time zone changes are not supported in MVP; time_zone is immutable after creation.

## Open questions
- Add formal recurrence math pseudocode?
- Define explicit today/overdue query behavior?

## Occurrence storage decision
- Use lazy occurrence generation from the series definition.
- Store only per-occurrence overrides (exceptions) when a user action changes a single date.
- Overrides win over generated defaults when building the week view.
- Precomputed full occurrence tables are post-MVP.

## Tech Stack (Draft)
- Frontend: Next.js + TypeScript.
- UI: Tailwind CSS.
- Auth: Auth.js magic-link (email via SMTP).
- Backend: Next.js API routes (route handlers) for MVP.
- Database: Postgres in EU region (provider pending).
- Hosting: pending (Vercel vs Render EU vs Fly.io).
- Considering AWS hosting/DB (EU region).
- Progressive Web App (PWA) support: PWA-lite deferred to post-MVP; push notifications considered for future.
