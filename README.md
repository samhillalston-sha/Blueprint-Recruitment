# Blueprint Recruiting

A private recruiting workspace for NYC Blueprint leadership. It keeps recruiting memory in one place, with individual Google sign-in and manually approved leadership access.

## Current scope — Phase 3

Phase 1 is deployed at https://blueprint-recruitment.vercel.app. The user confirmed Google sign-in, manual approval, and dashboard access on September 17, 2026.

Phase 2 is merged, and the user confirmed the deployed prospect screens.

Phase 2 adds:
- Persistent prospect records and separate season candidacies with RLS and minimal client grants.
- A paginated prospect list, name search, and selected-season / all-people views.
- Creation and editing of shared player facts; only a name is required.
- Case/spacing-normalized duplicate-name warnings with links to existing profiles and an explicit different-person override.
- Prospect profiles, season history, and adding an existing person to another active season.

Closed seasons are read-only in the application. Shared facts reflect the latest person details across years; they are not historical snapshots. Client deletion or reassignment of season records is unavailable.

Phase 3 adds seasonal stages (Unknown Prospect, Known Prospect, Confirmed for Tryouts), optional High/Medium/Low priority, approved leadership owners, next actions, follow-up dates, and three qualitative year-by-year projections. The prospect list shows the selected season's workflow and the dashboard uses real stage counts.

The profile's paginated activity timeline spans all seasons. Database triggers log creation, season membership, important shared-fact edits, and workflow changes with author, timestamp, season context, and before/after values. No-op edits do not create events. Logging begins with this migration; prior changes are not reconstructed. Version checks prevent stale forms from overwriting another leader's changes.

Notes, manual interaction entries, evaluations, outcomes, imports, AI, and tryout/roster management remain outside scope. Stop before Phase 4.

## Development and verification

Requires Node 22+ and npm. Dependencies and lockfile are unchanged.

```sh
npm ci
npm run dev
npm run test
npm run typecheck
npm run build
npm run test:runtime
```

Create `.env.local` using the variable names in `.env.example`. Use a publishable Supabase key, never a secret/service-role key. Set `APP_URL` to the canonical app origin. Missing/invalid configuration fails closed. Keep individual leadership logins.

See [setup](docs/SETUP.md), [scope](docs/SCOPE.md), and [verification](docs/VERIFICATION.md). GitHub Actions runs the application checks against isolated synthetic fixtures. Hosted permission scripts roll back all test data.

## Privacy

This public repository contains source, not a recruiting dataset. Never commit real prospect names, contact information, ratings, notes, credentials, exports, or private screenshots. Any future portfolio demo must be wholly synthetic and separately isolated. `APP_ENV=demo` does not bypass authorization.
