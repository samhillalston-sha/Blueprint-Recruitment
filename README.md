# Blueprint Recruiting

A private recruiting workspace for NYC Blueprint leadership. Built from a real operational need: keep recruiting knowledge in one place instead of scattered spreadsheets, messages, and captain memory.

## Phase 1 scope

This checkpoint implements **only the application foundation**:

- Next.js App Router, TypeScript, Tailwind, reusable shadcn-compatible UI primitives.
- Invite-only Supabase magic-link sign-in and local sign-out.
- Server-verified identity plus an active leadership profile; authorization checked in the proxy, layout, pages, and database.
- Branded, responsive Dashboard / Prospects / Settings shell and season selection.
- 2027 current season and 2026 historical season, stored in Supabase.
- RLS-protected leadership profiles and seasons; no client write privileges.

Dashboard pipeline counts are explicitly unconnected. Prospects is a placeholder. There is no prospect CRUD, evaluation workflow, data import, AI, tryout management, or roster mapping in this phase.

## Local development

Requires Node 22+ and npm. Dependencies are pinned; the lockfile is committed.

```sh
npm ci
```

Create `.env.local` using the variable names in `.env.example`. Use a modern **publishable** Supabase key, never a secret/service-role key. Set `APP_URL` to your canonical origin (for local development, `http://localhost:3000`). Missing/invalid configuration disables sign-in and fails closed for private routes.

```sh
npm run dev
npm run test
npm run typecheck
npm run build
npm run test:runtime
```

See [setup](docs/SETUP.md) for hosted database and Auth steps, and [verification](docs/VERIFICATION.md) for the latest test results and limits.

The runtime suite requires a completed production build. It runs the real Next.js server against synthetic, isolated Auth/database fixtures; no credentials or real emails are required. GitHub Actions repeats these checks on pushes and pull requests.

## Hosting

Standard Next.js, intended for Vercel. Connect this repository to Vercel, supply the environment variables, and configure the exact deployed origin in Supabase Auth. Deployment is not included in this checkpoint.

## Privacy

This is a public source repository, **not a public recruiting dataset**. Do not commit real prospect names, contact details, ratings, notes, credentials, exported tables, or screenshots of private recruiting data. A future portfolio demo must use wholly synthetic data in an isolated environment. `APP_ENV=demo` is intentionally unsupported in Phase 1 and does not bypass authorization.

## Working agreement

Phase 1 must be verified and explicitly approved before Phase 2 begins. See [scope and future requirements](docs/SCOPE.md).
