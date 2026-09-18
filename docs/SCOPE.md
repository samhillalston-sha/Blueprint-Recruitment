# Scope and product decisions

## Problem

Leadership needs shared recruiting memory and clear ownership during offseason outreach, not a complex sports management platform. The useful recruiting journey is from first hearing a name to confirming interest in spring tryouts. Everyone ultimately has to try out; attendance confirmation is not a roster offer.

## Phase 1 — deployed and user-confirmed

Authentication, leadership access, navigation, branding, seasons, shell screens, tests, setup documentation. No real player import. No operational recruiting claims until subsequent phases are implemented.

## Phase 2 — merged prospect foundation

Persistent people and separate season memberships; list/search/pagination; create/edit shared facts; duplicate-name warning; profile and season history; reuse an existing person in an active season. No real-data import. Closed season membership is preserved and read-only; shared person facts are current values, not per-year snapshots.

The user confirmed the deployed prospect screens after merging Phase 2.

## Phase 3 — merged recruiting workflow

- Seasonal stages: Unknown Prospect, Known Prospect, Confirmed for Tryouts. These remain separate from future season outcomes.
- Optional High / Medium / Low priority, approved active leadership owner, free-text next action, and follow-up date. No invented priority or owner defaults.
- Three qualitative text projections for the season year and the following two years. This is a player outlook, not roster composition planning. Unknown projections remain blank.
- Profile activity timeline with author, timestamp, season/shared-facts context, and before/after values. Database triggers automatically log important changes, including writes outside the UI. Clients cannot forge, edit, or delete events. No-op edits are suppressed; earlier changes are not fabricated.
- Selected-season workflow columns and actual dashboard stage counts. Follow-up labels use UTC calendar dates; dates do not send notifications.
- Distinct workflow and outlook for each season. Closed seasons remain read-only. Revoked owners remain in existing records; new assignments require active leadership. Version checks reject stale saves.

## Phase 4 — authorized dashboard

- Real stage counts and independently paginated operational queues, ten rows per page with exact totals.
- Overdue follow-ups have dates before today; upcoming includes today and all later dates. All comparisons use the database's UTC calendar date in one consistent snapshot. Unscheduled prospects appear in neither date queue.
- Missing owners means no assignment, without clearing revoked owners. Missing next actions includes null, empty and whitespace-only text.
- Recent activity includes selected-season events plus shared-fact events for people with membership in the selected season; it excludes other seasons' workflow changes and people outside the season.
- Prospect links preserve the selected season. Historical dashboards compare stored dates with today and label the records read-only. These are current records, not reconstructed historical snapshots.
- No new reminders, notes, evaluations, outcomes or imports.

Stop before Phase 5. Notes, manual interaction entries, evaluations, outcomes, imports, reminders/notifications, AI, and tryout/roster management are not authorized.

## Agreed later recruiting requirements — remaining work

- Evaluations: Athleticism, Offensive Ability, Defensive Ability, Coachability, On Field Vibes, Off Field Vibes; each 1–5 or N/A, with 5 highest. Leadership can see individual and aggregate evaluations **before submitting their own**.
- Notes, manual interaction history, and additional workflow filters. Name search and follow-up identification already exist.
- Seasonal outcomes: Still Active, Rostered, Practice Player, Cut–Encourage to Return, Cut–Closed, Withdrew/Chose Another Team, Did Not Attend. These are separate from recruiting stages.
- Initial private import will be limited to available source fields; don't invent ratings, physical attributes, interest, or contact details. Private player data must not enter this public source repository.

## Later enhancements

Tryout-event management, roster mapping/three-year composition planning, automation, AI summaries, and a separately isolated synthetic portfolio demo. None is needed to make the foundation useful or ready for the next phase.
