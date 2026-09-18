# Scope and product decisions

## Problem

Leadership needs shared recruiting memory and clear ownership during offseason outreach, not a complex sports management platform. The useful recruiting journey is from first hearing a name to confirming interest in spring tryouts. Everyone ultimately has to try out; attendance confirmation is not a roster offer.

## Phase 1 — deployed and user-confirmed

Authentication, leadership access, navigation, branding, seasons, shell screens, tests, setup documentation. No real player import. No operational recruiting claims until subsequent phases are implemented.

## Phase 2 — merged prospect foundation

Persistent people and separate season memberships; list/search/pagination; create/edit shared facts; duplicate-name warning; profile and season history; reuse an existing person in an active season. No real-data import. Closed season membership is preserved and read-only; shared person facts are current values, not per-year snapshots.

The user confirmed the deployed prospect screens after merging Phase 2.

## Phase 3 — merged recruiting workflow

- Seasonal stages: Unknown Prospect, Known Prospect, Confirmed for Tryouts. These remain separate from season outcomes.
- Optional High / Medium / Low priority, approved active leadership owner, free-text next action, and follow-up date. No invented priority or owner defaults.
- Three qualitative text projections for the season year and the following two years. This is a player outlook, not roster composition planning. Unknown projections remain blank.
- Profile activity timeline with author, timestamp, season/shared-facts context, and before/after values. Database triggers automatically log important changes, including writes outside the UI. Clients cannot forge, edit, or delete events. No-op edits are suppressed; earlier changes are not fabricated.
- Selected-season workflow columns and actual dashboard stage counts. Follow-up labels use UTC calendar dates; dates do not send notifications.
- Distinct workflow and outlook for each season. Closed seasons remain read-only. Revoked owners remain in existing records; new assignments require active leadership. Version checks reject stale saves.

## Phase 4 — merged dashboard

- Real stage counts and independently paginated operational queues, ten rows per page with exact totals.
- Overdue follow-ups have dates before today; upcoming includes today and all later dates. All comparisons use the database's UTC calendar date in one consistent snapshot. Unscheduled prospects appear in neither date queue.
- Missing owners means no assignment, without clearing revoked owners. Missing next actions includes null, empty and whitespace-only text.
- Recent activity includes selected-season events plus shared-fact events for people with membership in the selected season; it excludes other seasons' workflow changes and people outside the season.
- Prospect links preserve the selected season. Historical dashboards compare stored dates with today and label the records read-only. These are current records, not reconstructed historical snapshots.
- No new reminders, notes, evaluations, outcomes or imports.

## Phase 5 — implemented evaluations (PR #4)

- Six seasonal attributes: Athleticism, Offensive Ability, Defensive Ability, Coachability, On Field Vibes, Off Field Vibes. Every entry explicitly chooses an integer 1–5 (5 highest) or N/A; blank choices cannot submit.
- One evaluation per leader and seasonal candidacy. Authors can edit their own current-season scores; others cannot overwrite them. Version checks reject stale edits and duplicate first submissions. Client deletion, author changes and season reassignment are unavailable.
- All approved leaders can see individual evaluations and averages before submitting their own. No self-submission gate or blind-review mode.
- Attribute averages exclude N/A, show independent numeric and N/A counts, and use every submitted evaluation, including retained former leaders. No evaluations and an all-N/A evaluation remain distinct. No numeric scores produces an N/A average, never a zero.
- Individual ratings appear in the evaluator comparison table with trusted evaluator names and UTC update times. Comparison pages have 25 rows; averages and the caller's entry include all records regardless of the selected page.
- Historical seasonal evaluations remain read-only and independent. Submitted/updated evaluations appear in the existing timeline and selected-season dashboard activity, with trusted authorship and before/after values. No-op saves do not create events or advance versions.

## Phase 6 — authorized historical continuity

- Optional seasonal outcomes: Still Active, Rostered, Practice Player, Cut–Encourage to Return, Cut–Closed, Withdrew/Chose Another Team, Did Not Attend. Unset means not recorded; outcomes never change the recruiting stage. Existing records retain unknown outcomes. Outcome edits use candidacy versions and automatic trusted activity.
- Profiles show the nearest previous recorded season, including gaps, with its stage/outcome and a link to its preserved workflow, projections and evaluations. Season history links retain the selected year. Shared player facts are current values, not historical snapshots.
- Approved leaders can start an empty season after the latest existing year in Settings. It becomes current without automatically closing other active seasons. Direct season writes remain denied; guarded RPCs validate approval and serialize transitions.
- Closing requires typing the exact year, records a trusted closure author/time, removes the current flag, preserves all rows and freezes seasonal workflow, outcomes, membership additions and evaluations in the database. It does not assign missing outcomes, delete history or clear workflow. In-flight seasonal mutations hold the season lock until their transaction completes. The app has no reopen action. Earlier closed seasons keep unknown closure metadata; do not fabricate it.
- Historical profiles can add the same person to an eligible later active season. Membership uniqueness prevents duplicates; new records start at Unknown Prospect with no outcome, owner, priority, actions, dates, projections or evaluations. No prior seasonal records are copied or modified. If no season is current, selection prefers the latest remaining active season, then the latest historical season.

Stop before Phase 7. Notes, manual interaction entries, imports, reminders/notifications, AI, and tryout/roster management are not authorized.

## Agreed later recruiting requirements — remaining work

- Notes, manual interaction history, and additional workflow filters. Name search and follow-up identification already exist.
- Initial private import will be limited to available source fields; don't invent ratings, physical attributes, interest, or contact details. Private player data must not enter this public source repository.

## Later enhancements

Tryout-event management, roster mapping/three-year composition planning, automation, AI summaries, and a separately isolated synthetic portfolio demo. None is needed to make the foundation useful or ready for the next phase.
