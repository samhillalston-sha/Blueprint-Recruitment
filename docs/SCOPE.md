# Scope and product decisions

## Problem

Leadership needs shared recruiting memory and clear ownership during offseason outreach, not a complex sports management platform. The useful recruiting journey is from first hearing a name to confirming interest in spring tryouts. Everyone ultimately has to try out; attendance confirmation is not a roster offer.

## Phase 1 — deployed and user-confirmed

Authentication, leadership access, navigation, branding, seasons, shell screens, tests, setup documentation. No real player import. No operational recruiting claims until subsequent phases are implemented.

## Phase 2 — authorized prospect foundation

Persistent people and separate season memberships; list/search/pagination; create/edit shared facts; duplicate-name warning; profile and season history; reuse an existing person in an active season. No real-data import. Closed season membership is preserved and read-only; shared person facts are current values, not per-year snapshots.

Phase 2 stops before stages, ownership, priorities, next actions, follow-ups, notes, interactions, evaluations, seasonal outcomes, or other Phase 3 workflows. Dashboard pipeline counts remain unconnected.

## Agreed later recruiting requirements — not implemented

- A persistent person/prospect record, with a distinct recruiting candidacy for each season; keep history across years.
- Stages: Unknown Prospect, Known Prospect, Confirmed for Tryouts.
- Priority: High / Medium / Low.
- Owner, free-text next action, and optional follow-up date.
- Player facts: name, contact/social links, location, teams, age, height; position only Handler or Cutter, optionally unknown.
- Evaluations: Athleticism, Offensive Ability, Defensive Ability, Coachability, On Field Vibes, Off Field Vibes; each 1–5 or N/A, with 5 highest. Leadership can see individual and aggregate evaluations **before submitting their own**.
- Notes, interaction history, search/filtering, follow-up identification, and a qualitative three-year outlook.
- Seasonal outcomes: Still Active, Rostered, Practice Player, Cut–Encourage to Return, Cut–Closed, Withdrew/Chose Another Team, Did Not Attend. These are separate from recruiting stages.
- Initial private import will be limited to available source fields; don't invent ratings, physical attributes, interest, or contact details. Private player data must not enter this public source repository.

## Later enhancements

Tryout-event management, roster mapping/three-year composition planning, automation, AI summaries, and a separately isolated synthetic portfolio demo. None is needed to make the foundation useful or ready for the next phase.
