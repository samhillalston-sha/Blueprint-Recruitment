# Blueprint Recruiting

A production recruiting workspace for NYC Blueprint leadership. It turns offseason recruiting from scattered memory into a shared, season-aware system for identifying prospects, assigning follow-up, recording evaluations and preserving history.

**Status:** Application work across all eight planned phases is implemented and merged. The production deployment is working and Phase 8 verification has passed.

- **Live product:** [blueprint-recruitment.vercel.app](https://blueprint-recruitment.vercel.app)
- **Synthetic demo:** [blueprint-recruitment.vercel.app/demo/](https://blueprint-recruitment.vercel.app/demo/)
- **Portfolio:** [Case study](docs/CASE_STUDY.md) · [Architecture](docs/ARCHITECTURE.md) · [Screenshots](docs/SCREENSHOTS.md)

Product owner: Sam Alston, NYC Blueprint captain. Implementation assistance: Codex.

## Product capabilities

- **Private leadership access:** individual Google sign-in, manual approval and server-verified authorization. New accounts are inactive by default.
- **Prospect database:** persistent player profiles, search, pagination, creation/editing and duplicate-name warnings.
- **Seasonal workflow:** separate stages, priorities, owners, next actions, follow-up dates and qualitative three-year projections for every season.
- **Operational dashboard:** stage totals, overdue and upcoming follow-ups, missing owners, missing actions and recent activity.
- **Evaluations:** six 1–5 or N/A attributes, one evaluation per leader, author-only editing, attribute averages and evaluator comparison.
- **Historical continuity:** optional season outcomes, read-only closed seasons, previous-season context and reuse of the same person in a later season with fresh workflow.
- **Trusted activity:** important changes are logged automatically with actor, timestamp and before/after values in the same database transaction.
- **Private import tooling:** validates up to ten known-source prospects and prepares a guarded atomic import without committing source data.
- **Portfolio demo:** ten fictional prospects across two sample seasons in a read-only static environment with no Auth or database connection.

Shared player facts remain current across seasons. Recruiting workflow, outcomes and evaluations remain season-specific. Closing a season preserves its records and prevents further seasonal edits.

## Architecture

The application uses Next.js 16, React 19, Supabase Auth/Postgres and Vercel.

- Next.js Server Components and Server Actions render the private workspace and process mutations.
- Every private request verifies the current identity with Supabase Auth, then checks the user’s active leadership profile.
- Postgres row-level security, column grants, guarded functions and database triggers provide the final authorization and audit boundary.
- Persistent people are separated from seasonal candidacies so history is retained without copying profiles.
- The synthetic demo is generated as static files and cannot enter the private application.

See [Architecture](docs/ARCHITECTURE.md) for the full data model, trust boundaries and deployment flow.

## Verification

The completed system is covered across application, database, browser and deployment layers:

- 40 unit tests.
- 49 production-runtime and hydrated-browser tests with zero failures or skips in the final hosted run.
- Phase 1–7 hosted Supabase permission and data-isolation regressions using rollback-only synthetic fixtures.
- Desktop and mobile checks for the private workflow, dashboard, evaluations, continuity, login, empty states, error states and demo.
- Read-only production checks for login configuration, security headers, anonymous private-route redirects, demo availability and the branded 404.

The owner has confirmed Google sign-in, leadership approval and production workspace access. See the [Phase 8 verification matrix](docs/PHASE8_VERIFICATION.md) and [verification history](docs/VERIFICATION.md) for detailed evidence.

## Development

Requires Node 22+, npm and Python 3.11+ for the private import tooling tests.

    npm ci
    npm run dev
    npm run test
    npm run typecheck
    npm run build
    npm run test:runtime
    npm run verify:deployment

Copy [.env.example](.env.example) to .env.local and provide:

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- APP_URL
- APP_ENV=private

Use a modern Supabase publishable key—never a secret or service-role key. Missing or unsafe configuration fails closed.

To run only the static demo without credentials:

    npm run build:demo
    python3 -m http.server 3001 --directory public/demo

## Private imports

The import tool defaults to validation-only and never logs source values. It supports stable retry IDs, explicit duplicate resolution and atomic writes to an active season.

See [Private import guide](docs/IMPORT.md). Real CSV inputs and generated SQL belong outside Git or under ignored data/private/.

## Documentation

- [Product case study](docs/CASE_STUDY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup and operations](docs/SETUP.md)
- [Product scope and decisions](docs/SCOPE.md)
- [Demo guide](docs/DEMO.md)
- [Screenshot provenance](docs/SCREENSHOTS.md)
- [Verification history](docs/VERIFICATION.md)

## Privacy and boundaries

This public repository contains source code and deliberately synthetic portfolio assets—not Blueprint’s recruiting dataset. Never commit real prospect names, contact details, ratings, credentials, private exports, generated import SQL or private-workspace screenshots.

Prospects may be entered manually in the approved production workspace. The repository and demo remain free of real player data.
