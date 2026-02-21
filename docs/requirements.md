# Chore Share App - Requirements Log

## Session Log

### 2026-02-21
- Goal: Start requirements gathering and document the process.
- App category: Shared household chore tracking app with editable chore list and presets.
- Primary user persona: End customers (people living together).
- First-session outcome: Complete a task by creating a household, adding/accepting members, and assigning or scheduling the first chore.
- Constraints: Short timeline and compliance considerations.
- Roles: Admins + members for MVP.

## Problem Statement (Draft)
People living together need a simple way to coordinate recurring household chores, clarify responsibility, and keep a shared understanding of what needs to be done and when.

## Core Users
- Housemates/roommates (primary end users)

## Primary Outcome
- In the first session, users can set up a household, add/accept members, and create or assign the first chore.

## Core Use Cases (Draft)
- Create a household and invite housemates.
- Accept an invite and join a household.
- Browse chore presets and add/edit chores.
- Assign a chore to a person.
- Self-assign a chore from the shared list.
- Schedule recurring chores with due dates.
- Mark chores as done.

## Presets vs Custom
- Provide predefined chore presets (rooms and common tasks).
- Allow users to edit, add, or remove chores.
- Presets are read-only; households add presets to create editable chores.
- Categories: fixed list for MVP; future per-household customization.
- Categories include rooms and task types.
- Preset names are localized in MVP.

## Localization (Draft)
- Preset names support localization in MVP.
- Full UI localization in MVP.
- Household language selected by admins.
- On account creation, user locale is initialized from household locale and stored.
- Household language changes apply only to new users (existing users keep their stored locale).
- User locale override supported in MVP.
- MVP languages: English + Polish.
- No RTL support in MVP.
- Use locale-aware pluralization and date/time formatting.
- Date/time formats follow the user locale.
- In-app reminder copy is localized.
- Preset categories are localized.
- Email templates (magic link, invites) are localized.

## Assignment Model
- Manual assignment by admins.
- Members can self-assign from available chores.
- Future: round-robin per chore with cadence.
- MVP: members can assign chores to other members.
- Future: household setting to allow/disable member-to-member assignment.
- MVP: self-assign can take over already assigned chores without confirmation.
- Future: household setting to allow/disable take over behavior.
- Take-over events are logged with previous assignee.
- Take-over actions support quick undo.

## Constraints
- Short timeline: prioritize an MVP with minimal complexity.
- Compliance: GDPR/UK GDPR; handle personal data responsibly; be clear on data retention and access.

## Roles and Household Setup
- Role model: Admins + members.
- Household size: no hard limit; document a soft guideline (e.g., up to 12).
- Invites: admins send email invite links; members join by accepting the invite.
- Chore management: all members can add/edit/delete chores.
- Invite management: admins only.

## Open Questions
- Confirm MVP inclusion for PWA-lite (manifest + offline fallback).
- Decide backend approach: Next.js API routes vs lightweight Node server.
- Choose database provider (EU Postgres) and hosting.
- Define initial preset catalog and categories (English + Polish).
- Define micro-feedback message set (English + Polish).

## MVP Scope (Draft)
- Household creation and invites (admins manage invites/settings).
- Chore list from presets plus custom edits.
- Assign or schedule a chore.
- Scheduling includes due date with optional recurrence.
- Due date is optional for chores.
- Allow self-assignment for available chores.
- Mark as complete and view recent history.
- In-app reminders for upcoming/overdue chores.
- No points/effort fields in MVP.

## MVP User Stories and Acceptance Criteria (Draft)

User Story 1: As a new user, I can create a household so I can organize chores with housemates.
- Acceptance: user can create a household with a name.
- Acceptance: creator becomes an admin member of the household.

User Story 2: As an admin, I can invite housemates so they can join the household.
- Acceptance: admin can send an email invite to a valid email address.
- Acceptance: invite is in a pending state until accepted.

User Story 3: As an invited user, I can accept an invite so I can join the household.
- Acceptance: invite link allows the user to accept and join.
- Acceptance: user becomes a member of the household on acceptance.

User Story 4: As a member, I can browse chore presets so I can quickly set up chores.
- Acceptance: preset list includes rooms and common tasks.
- Acceptance: presets can be added to the household chore list.

User Story 5: As a member, I can add or edit chores so the list matches our needs.
- Acceptance: user can create a custom chore with a name.
- Acceptance: user can edit or remove a chore from the household list.

User Story 6: As an admin, I can assign a chore to a person so responsibilities are clear.
- Acceptance: admin can assign a chore to a specific member.
- Acceptance: assigned chore shows the assignee.

User Story 7: As a member, I can self-assign a chore so I can take responsibility.
- Acceptance: member can claim an unassigned chore.
- Acceptance: claimed chore shows the new assignee.

User Story 8: As a member, I can schedule a due date and recurrence so chores repeat.
- Acceptance: chore can have a due date.
- Acceptance: recurrence can be set to a simple cadence (e.g., weekly).

User Story 9: As a member, I can mark a chore complete so the household sees progress.
- Acceptance: completion marks the chore as done.
- Acceptance: completion appears in recent history.

User Story 10: As a member, I can see upcoming and overdue chores so I know what to do.
- Acceptance: in-app view shows upcoming chores.
- Acceptance: overdue chores are highlighted in-app.

## MVP User Flows (Draft)

Flow A: First session (household creator)
1. Landing or sign up.
2. Create household (name).
3. Creator becomes admin.
4. Add chores from presets and/or create a custom chore.
5. Assign or self-assign the first chore.
6. Set due date and optional recurrence.
7. See upcoming/overdue view.

Flow B: First session (invited member)
1. Receive email invite.
2. Open invite link and accept.
3. Join household as member.
4. View chore list and upcoming/overdue.
5. Self-assign a chore or accept an assigned chore.
6. Mark a chore complete.

Flow C: Daily use (member)
1. Open app and see upcoming/overdue chores.
2. Self-assign an available chore if needed.
3. Complete chore and mark as done.
4. Review recent history.

## Non-Functional Requirements (Draft)

Performance
- Responsive UI on mobile and desktop for list, assign, and complete flows.
- Target P95 load time: < 2s on broadband, < 4s on 3G for core pages.

Security
- Enforce authentication for all household data.
- Authorization based on admin/member roles.
- Encrypt data in transit; store only required personal data.

Privacy and GDPR/UK GDPR
- Data minimization and purpose limitation.
- Provide data export and deletion on request.
- Retention: inactive accounts 12 months; pending invites expire after 7 days.
- Notify users before inactive account deletion.
- Inactive definition: no activity events (no chore actions) for 12 months.
- Document data processor/subprocessor list.

GDPR deletion requests
- MVP: handled via account deletion (no separate request flow).

GDPR data export
- MVP: support-assisted export.
- Future: self-serve export.
- Notifications are excluded from export.

Household export
- MVP: not available.
- Future: admin self-serve export.

Reliability
- Basic backup and restore strategy.
- Graceful error handling for invite and assignment flows.

Accessibility
- Target WCAG 2.1 AA for core flows.

## Data Model Outline (Draft)

Household
- id
- name
- name max length 60
- created_at
- color (optional)

User
- id
- email
- name (optional)
- name max length 60 (optional)
- avatar (predefined icon id for MVP; uploadable image in future)
- Users can change avatar anytime in MVP.
- Avatar selection uses a preset icon list.
- locale (stored per user; defaults from household)
- created_at

HouseholdMembership
- id
- household_id
- user_id
- role (admin or member)
- status (active)
- joined_at

Invite
- id
- household_id
- email
- token
- status (pending, accepted, expired)
- sent_at
- expires_at

Chore
- id
- household_id
- name
- name max length 60
- description (optional, max length 200)
- estimated_minutes (optional, future)
- category (room or task)
- is_active
- created_at

ChorePreset
- id
- name
- localized_names (map; MVP localization support)
- category (room or task)
- No default recurrence in presets (MVP).
- Category is required for presets.
- No suggested estimated minutes in presets (MVP).

ChoreAssignment
- id
- chore_id
- assignee_user_id (nullable for unassigned; single assignee only)
- assigned_by_user_id
- due_date (nullable)
- recurrence_rule (nullable; simple cadence only)
- status (open, completed)
- completed_at (nullable)

ChoreHistory
- id
- chore_id
- completed_by_user_id
- completed_at

Relationships
- Household has many HouseholdMembership, Invite, Chore.
- User has many HouseholdMembership and ChoreHistory entries.
- HouseholdMembership links User to Household with role.
- Invite belongs to Household; accepted invite creates HouseholdMembership.
- Chore belongs to Household.
- ChoreAssignment belongs to Chore and optionally to an assignee User.
- ChoreHistory belongs to Chore and the completing User.
- UserPreferences belongs to User.
- Achievement belongs to Household.

Constraints and Indexes (Draft)
- User.email unique.
- HouseholdMembership unique on (household_id, user_id).
- Invite unique on (household_id, email, status=pending).
- Invite.token unique.
- Chore name unique per household (can relax if needed).
- ChoreAssignment.status constrained to open or completed.
- Indexes on: household_id for HouseholdMembership, Invite, Chore; assignee_user_id and due_date for ChoreAssignment.

Recurring Chores (Draft)
- ChoreAssignment represents a single occurrence.
- Recurrence is calendar-based and anchored to the due date.
- Next occurrence is created on schedule (e.g., next Monday) regardless of early completion.
- If skipped or overdue, the next scheduled occurrence is still created.
- Recurrence cadence: MVP weekly only; future daily/weekly/monthly; no N-intervals.
- Weekly recurrence requires selecting a weekday.
- Recurrence edits apply to future occurrences only.
- Due date changes affect only the current occurrence (do not shift recurrence schedule).
- Overdue recurring chores do not pile up; when a new occurrence is created, any prior open occurrence is auto-skipped (logged in history).
- Auto-skipped occurrences include a standard reason.
- MVP: auto-skip events visible to all members; future: household setting for visibility.
- Snooze is allowed on recurring chores and affects only the current occurrence.
- Skip is allowed on recurring chores and affects only the current occurrence.
- Recurring chores auto-assign to the last assignee.
- If last assignee leaves, next recurrence is unassigned.
- Skipping a recurring chore skips only that occurrence.

## MVP Screens and Page-Level Requirements (Draft)

Screen: Auth (sign up / log in)
- Email-based authentication.
- Access invite acceptance flow when arriving via invite link.

Screen: Create household
- Create household with name.
- Creator becomes admin.
- After creation, show a brief onboarding checklist.
- Checklist items: invite a member, add first chore, assign first chore.
- Onboarding checklist is dismissible.
- Checklist can be reopened from the dashboard if incomplete.
- Checklist progress appears as a small dashboard card.
- Checklist shows percentage complete plus item list.
- Checklist items link to their actions.
- Checklist items auto-complete when actions are done.
- Checklist hides when complete (after a brief completion message).
- Checklist progress is shared at the household level.
- Prompt for household color/avatar selection during creation.
- Show gentle invite prompt if household has only one member.
- Invite prompt is dismissible per user.
- Invite prompt can reappear after a week if no one joins.

Screen: Household dashboard (chore list)
- Show upcoming and overdue chores (in-app reminders).
- Show unassigned chores available for self-assignment.
- Unassigned chores visible to all members.
- Provide quick actions: assign, self-assign, complete.
- Provide filters by room/category.
- Room/category filters are multi-select.
- No chore search in MVP.
- Provide a "My chores" filter for assigned-to-me items.
- "My chores" filter overrides sections (shows only assigned-to-me across sections).
- No separate "Unassigned" filter (section only).
- Remember last-used filter per user.
- Filters are stored per user per household.
- No household switcher in MVP.
- Provide a "Manage chores" button linking to the chore editor.
- "Manage chores" is visible to all members.

Screen: Notifications
- In-app notification center list for key notices.
- Accessed from a bell icon in the header.
- Notifications can be dismissed individually.
- Notifications auto-expire after 7 days.
- Group similar notifications in the list.
- Notifications include contextual actions (e.g., view chore, assign to me).
- Bell icon shows unread count badge.
- Notifications are marked read when viewed.
- Allow "Mark all as read".
- Notifications auto-clear when the underlying condition is resolved.
- Notification center includes a link to notification settings.
- Notification center shows all notifications across households when multi-household is supported.
- Notifications are grouped by household when multi-household is supported.
- No notification sounds in MVP.
- No notification priority levels in MVP.
- No notification categories/filters in MVP.
- Show friendly empty state when no notifications.

Screen: Chore editor
- Add from presets and create custom chores.
- Edit or deactivate chores.
- Archived chores hidden by default; accessible in an Archived view.
- Allow adding multiple chores in a single flow.
- Custom chores require a room/category selection.
- Estimated minutes is optional (future).
- Categories can be edited for existing chores.
- Include a basic search/filter in the editor.
- Editor search defaults to active chores only.
- Editor includes a "Show archived" toggle.

Screen: Assign/schedule chore
- Admin assigns a chore to a member.
- Set due date and optional recurrence.

Screen: Invite management (admin)
- Send email invites.
- View pending invites and expiration.

Screen: Invite acceptance
- Accept invite and join household.
- Invite acceptance requires sign-up via magic link.
- Display name defaults from email prefix (editable later).
- Prompt for avatar selection during acceptance (quick picker).
- User locale is set to household locale on acceptance (editable later).
- Invite acceptance sets household as the current context.
- If user already belongs to a household, block acceptance with a message (MVP).

Screen: Completion history
- Show recent activity by chore and member (assign, reassign, snooze, skip, complete).
- Visible to all members.
- MVP: no filters; future: filter by member and chore.
- History feed includes undo events.
- No activity log export in MVP.
- Show relative timestamps with exact time on hover.
- Profile changes are not logged in history.
- Default history view shows last 30 days.
- Users can load more history beyond 30 days.
- History load more uses pagination (not infinite scroll).
- History page size: 20 events.

Screen: Household settings
- Manage household name.
- Manage member roles (admin/member).
- Show last completed date per member.
- Display last completed as relative time with exact date on hover.
- Member activity visibility is configurable per household.
- Default: visible to all members.
- MVP: minimal settings; future adds UX toggles (due-soon window, assignment rules, visibility).
- Select household color/avatar.
- Household color/avatar can be changed by admins only.
- Household color/avatar selected from a preset list.
- Household color/avatar changes do not require undo.
- No "house rules" note in MVP.
- Household language selection (admins only).
- Household language changes do not require undo.

Screen: User profile/settings
- Update display name.
- Change avatar.
- Override language selection.
- Accessed from dashboard header avatar/menu.
- MVP: email changes not supported; future: allow email change with re-verification.
- Self-serve account deletion in MVP (email-link confirmation).
- Show banner when account is pending deletion.
- Pending deletion banner includes "Cancel deletion" action.
- Micro-feedback toggle (per user).
- Nudges toggle (per user).
- Defaults: nudges on, micro-feedback on.
- Quiet hours configuration.
- Streak visibility toggle (per user).
- Default: streak visible.
- No undo for profile changes (name/avatar/locale).
- Notification settings live in user profile/settings.

## Wireframe Notes and UX Priorities (Draft)

Global UX priorities
- Fast path to first chore assignment.
- Keep core actions one tap/click away.
- Emphasize upcoming and overdue chores on the dashboard.
- Desktop layout uses top navigation only (no sidebar).
- Mobile layout uses a bottom navigation bar (Dashboard, Chores, Notifications, Settings).
- Bottom nav "Chores" routes to the dashboard.

Auth
- Keep auth minimal: email + magic link (passwordless).
- If invite link present, skip extra steps and go to accept flow.

Create household
- Single field (household name) and primary CTA.

Household dashboard
- Sections: Overdue, Due soon, Unassigned.
- MVP: Due soon window is next 48 hours; future: configurable per household.
- Each chore card shows name, assignee, due date, and action buttons.
- Chore cards show recurrence info when applicable.
- Chore detail/hover shows who assigned the chore.
- Chore detail uses a side panel/modal.
- Chore detail includes recent history for that chore.
- Chore detail history shows the last 10 events (no pagination).
- Chore detail allows editing (name/category/description).
- Chore detail history uses relative timestamps with exact time on hover.
- Chore detail shows next recurrence date when applicable.
- Chore detail shows assignee avatar/name prominently.
- Chore detail allows reassigning.
- Chore detail allows snooze/skip actions.
- Chore detail allows completion.
- MVP: chore detail does not show created-by; future option to display it.
- Primary actions: self-assign (if unassigned), complete (if assigned to me).
- Skip/snooze actions live in the chore detail panel (not on cards).
- Chore cards show a "Take over" action when assigned to someone else.
- Take-over is always available (not affected by quiet hours).
- Take-over shows a subtle confirmation message.
- Unassigned chores include an "assign to me" quick action.
- Overdue section includes subtle encouragement messaging.
- After quiet hours, show a small catch-up banner for overdue items.
- Catch-up banner is dismissible for the day.
- Show a "Quick win" callout for the shortest estimated chore assigned to the user when available.
- Quick win falls back to unassigned chores if the user has no assignments.
- Quick win is dismissible for the day.
- Archived chores are excluded from dashboard sections and Quick win.
- Show estimated minutes when available (future data).
- No bulk snooze for overdue chores in MVP.
- Completed chores remain visible for the rest of the day in a completed state.
- Completed chores are collapsed by default.
- Display personal streak in the dashboard header (private to user in MVP).
- Future: household setting to allow streak visibility to other members.
- Dashboard header shows today's date.
- Dashboard header includes a greeting.
- Greeting uses display name when available, otherwise generic.
- No "mark all done" action in MVP.
- Undated chores appear in the Unassigned section (no separate section in MVP).
- Due soon excludes undated chores.
- Allow per-user custom ordering of chores.
- Custom ordering is a single order across sections.
- Custom ordering is included in MVP.
- Custom ordering applies to all chores in the dashboard.
- Within sections, custom order is primary; due date is secondary.
- Users can reset custom order to default.
- Custom order is stored per user and syncs across devices.
- Custom order is per user per household.
- No bulk actions in MVP.
- No pinning feature in MVP.

Chore editor
- Presets presented by room/category.
- Custom chore creation inline.
- Preset picker supports select-many + confirm.
- Preset categories use a dropdown filter (not tabs).
- Preset picker allows bulk select-all per category.
- Preset picker includes a search field.
- Preset search filters instantly as you type.
- Preset search uses substring matching.

Assign/schedule
- Simple assignee picker.
- Due date calendar with optional recurrence dropdown.

Invite management
- Input email + send invite.
- Pending list with expiration date.
- No invite suggestions in MVP.
- Show invite expiration as relative time (e.g., "expires in 3 days").
- Invite resend rate limit: once per day.
- Invite revocation requires confirmation.
- Invite validation: email format only in MVP.
- Invites to existing user emails are allowed; acceptance links to the existing account.

Completion history
- Recent list grouped by day, showing who completed what.

## Motivation and ADHD Support (Draft)

MVP behaviors
- One-tap self-assign and complete actions.
- Emphasize a single next action (most urgent chore) on dashboard.
- Highlight quick wins (short chores) to reduce activation energy.
- Gentle reminders with easy snooze/reschedule.
- Positive, non-competitive feedback on completion.
- Show a short positive micro-feedback message after completion.
- Micro-feedback messages rotate from a small set.
- Micro-feedback can be disabled separately per user.
- Show a basic personal streak in MVP.
- Streak definition: any day with at least one completion.
- Streak resets after a missed day.
- Streak display shows current count only.
- Streak is hidden when count is 0.
- Streak display is independent of nudges setting.

Future enhancements
- Optional substeps/checklists per chore.
- Estimated time per chore for quick-win filtering.
- Focus timer per chore.
- Household progress rings and consistency streaks.
- Badges/achievements (opt-in and non-competitive).
- Streak pause/vacation mode.
- Weekly summary card.

## Additional Considerations (Draft)

Household lifecycle
- Admins can promote other members to admin.
- Admins can demote/remove other admins.
- No special "transfer" role required.
- Delete household.
- Leave household.
- Members can leave even with assigned chores; their chores become unassigned.
- Revoke/resend invites.
- Resend keeps the same invite token and extends expiry.
- Expired invites can be resent by extending expiry (same token).
- MVP: single household per user (no multi-household support).
- Household settings changes are logged in history.
- Settings changes are logged as a single "settings updated" event.
- Member joins via invite are logged in history.
- Invite revokes/resends are logged in history.
- Member leaves are logged in history.
- Admins can remove members.
- Member removal requires confirmation.
- Removing a member unassigns their chores.
- Removed members receive an email notification.
- Member removal supports a 10-second undo.

Admin leave policy
- If an admin is the only admin, they must promote another admin before leaving.

Admin demotion policy
- The last admin cannot demote themselves.

Admin promotion
- Promotion to admin requires confirmation.
- Admin promotions are logged in history.
- Admin demotions send an email notification.
- Admin promotions send an email notification.
- Admin role changes support a 10-second undo.

Household deletion policy
- Soft-delete household, revoke access immediately, and purge after 30 days.
- Household deletion is logged in history.
- No extra grace period beyond the 30-day purge window.
- Household deletion requires email-link confirmation.
- Household deletion can be canceled during the 30-day purge window.
- Show a pending-deletion banner to all members.
- Only admins can cancel household deletion.

Time zones
- Use household time zone for due dates.

Chore lifecycle
- Snooze with new due date (quick presets: 30m, 1h, end of day, tomorrow morning).
- Snooze allowed only by current assignee.
- Snooze events are logged in history.
- Snooze history includes only the new due date.
- Skip with a reason (fixed list + optional note).
- Skip allowed only by current assignee.
- MVP: skip reasons visible to all members.
- Future: household setting to control skip-reason visibility.
- Skip events are logged in history.
- Skip history stores reason category and optional note.
- Default skip reasons: Not enough time, Not my turn, Too tired, Supplies missing, Other.
- Reassign: admins can reassign any chore; members can reassign only chores assigned to themselves.
- MVP: no reassignment note.
- Future: optional reassignment note.
- Reassignment events are logged in history.
- Allow completion after due date without visible “late” label; keep internal late flag for future stats.
- Recurrence exceptions for missed or skipped chores.
- Skipped occurrences do not shift the recurrence schedule.
- Chore deletion is soft (archive).
- MVP: all members can archive chores; future: household setting to restrict to admins.
- MVP: all members can restore archived chores; future: household setting to restrict to admins.
- Restoring an archived chore preserves its history.
- Chore edits apply to future assignments only; history remains unchanged.
- Chore creation/edit/delete events are logged in history.
- All members can edit any chore.
- Completion uses a quick undo toast instead of a confirmation dialog.
- Skip and snooze actions also support quick undo.
- Reassign actions support quick undo.
- Assignment changes support quick undo.
- Assignment changes notify the previous assignee (in-app).
- No email notification for assignment changes in MVP.
- Quick undo available for 10 seconds.
- Undo creates a new history event (audit trail).
- Assigned chores may have no due date.
- Recurrence requires a due date.
- Take-over notifies the previous assignee (in-app).
- No email notification for take-over in MVP.

Privacy
- History retention when user leaves: retain entries, anonymize display name.
- Leaving a household removes household-related notifications.
- Account deletion: remove memberships and anonymize history.
- Account deletion uses a 7-day grace period before purge.
- Users can cancel deletion during the grace period.
- Account deletion removes all user notifications.

Notifications
- Quiet hours.
- In-app only with immediate indicators (no scheduled digest in MVP).
- Future: push notifications (PWA).
- Reminder indicators are suppressed during quiet hours.
- In-app notice when a chore becomes overdue (outside quiet hours).
- In-app notice when a chore is assigned to the user.
- In-app notice when a chore is unassigned or reassigned away from the user.
- MVP: no in-app notice when an assigned chore is completed by someone else; future configurable.
- No in-app notice for skip events in MVP.
- No in-app notice for snooze events in MVP.
- No in-app notice for chore edit events in MVP.
- No in-app notice for new chore creation in MVP.
- No in-app notice for chore archive/restore in MVP.
- No in-app notice for chore deletion in MVP.

Quiet hours
- Per-user quiet hours.
- Default quiet hours: 9pm–8am.
- Quiet hours are interpreted in the user’s local time zone.
- Single quiet-hours window for all days (no per-day customization in MVP).

## Tech Stack (Draft)
- Frontend: Next.js + TypeScript.
- UI: Tailwind CSS.
- Auth: Auth.js magic-link (email via SMTP).
- Backend: Next.js API routes or lightweight Node server (decision pending).
- Database: Postgres in EU region (provider pending).
- Hosting: pending (Vercel vs Render EU vs Fly.io).
- Considering AWS hosting/DB (EU region).
- Progressive Web App (PWA) support: PWA-lite optional for MVP; push notifications considered for future.

## Local Development Strategy (Draft)
- Start with local development only; hosting decision deferred.
- Use local Postgres for development; keep schema portable.
- Use local SMTP (e.g., Mailpit) for magic-link emails in dev.
- Avoid host-specific features to stay cloud-agnostic.

## Tooling (Draft)
- Package manager: Yarn 4.12.0 with node-modules linker.
- Linting/formatting: Biome.

## Out of Scope (Draft)
- Payments or monetization.
- Smart home integrations.
- Complex analytics or gamification beyond basic completion history.

## Future Data Models (Draft)

UserPreferences
- id
- user_id
- reminder_time (optional)
- nudges_enabled (boolean)
- micro_feedback_enabled (boolean)

Achievement
- id
- household_id
- name
- criteria (json)

PushSubscription
- id
- user_id
- endpoint
- p256dh
- auth
- created_at
