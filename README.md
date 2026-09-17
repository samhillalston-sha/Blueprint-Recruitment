# Blueprint Recruiting

A private recruiting workspace for NYC Blueprint leadership. It keeps recruiting memory in one place, with individual Google sign-in and manually approved leadership access.

## Current scope — Phase 2

Phase 1 is deployed at https://blueprint-recruitment.vercel.app. The user confirmed Google sign-in, manual approval, and dashboard access on September 17, 2026.

Phase 2 adds:
- Persistent prospect records and separate season candidacies with RLS and minimal client grants.
- A paginated prospect list, name search, and selected-season / all-people views.
- Creation and editing of shared player facts; only a name is required.
- Case/spacing-normalized duplicate-name warnings with links to existing profiles and an explicit different-person override.
- Prospect profiles, season history, and adding an existing person to another active season.

Closed seasons are read-only in the application. Shared facts reflect the latest person details across years; they are not historical snapshots. Client deletion or reassignment of season records is unavailable.

Recruiting stages, priorities, ownership, next actions, follow-ups, notes, evaluations, outcomes, imports, AI, and tryout/roster management are not implemented. Dashboard pipeline counts remain explicitly unconnected until stages are authorized. Stop before Phase 3.

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
