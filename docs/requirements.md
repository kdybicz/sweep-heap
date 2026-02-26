# Chores - Requirements (V3 Draft)

## Status
- Active: V3 (fresh start).
- Scope: chores only. No users, households, points, or UI.

## Core concept
- A chore is scheduled like a Google Calendar all-day event.
- It has a start_date, end_date, and a repeat rule.
- Dates are calendar dates only (no time-of-day).

## Scheduling (MVP)
- start_date: first scheduled date (required).
- end_date: last scheduled date, inclusive (required; end_date >= start_date).
- repeat: none | day | week | month | year.
- Recurrence is anchored to start_date.
- Monthly/yearly repeats snap to the last day of the month if needed.
- Custom repeat rules are post-MVP (intervals, weekdays, etc.).

## Chore types
- close_on_done: marking done closes the occurrence and removes it from active lists.
- stay_open: marking done records a completion but the occurrence stays active/visible.

## Lifecycle rules
- A chore is active between start_date and end_date inclusive.
- When current_date (in the chore time zone) is past end_date, the chore closes.
- close_on_done chores close on the first completion of an occurrence.
- stay_open chores never close due to completion; only schedule end closes them.

## Data model (draft)
Chore (series definition)
- id
- name
- type: close_on_done | stay_open
- start_date (date)
- end_date (date)
- repeat_rule (enum above)
- time_zone (IANA; required for date math)
- status: active | closed
- closed_reason: schedule_end | manual

ChoreOccurrence (derived per scheduled date)
- id
- chore_id
- occurrence_date (date)
- status: open | closed
- closed_reason: done | schedule_end
- last_completed_at (timestamp, optional)
- completed_count (int, optional; useful for stay_open)

Completion (history)
- id
- chore_id
- occurrence_id
- completed_at (timestamp)
