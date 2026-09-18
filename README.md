# Blueprint Recruiting

A private recruiting workspace for NYC Blueprint leadership, built to preserve recruiting memory across seasons and make the next action clear. Product owner: Sam Alston, NYC Blueprint captain. Implementation assistance: Codex.

**Production:** [blueprint-recruitment.vercel.app](https://blueprint-recruitment.vercel.app) — individual Google sign-in and manually approved leadership access. Phase 1 access and the Phase 2 deployed screens were confirmed by the user. Phases 3–5 are merged to main. Phase 6 PR #5 was merged into the Phase 5 branch; this Phase 7 PR carries its changes to main.

**Portfolio:** [Product case study](docs/CASE_STUDY.md) · [Architecture](docs/ARCHITECTURE.md) · [Synthetic screenshots](docs/SCREENSHOTS.md) · [Import guide](docs/IMPORT.md)

## What it does

- Persistent people with separate seasonal candidacies, a searchable/paginated prospect database, fact editing, and duplicate-name warnings with explicit same-name overrides.
- Seasonal recruiting stages, priorities, approved owners, next actions, UTC follow-up dates, and three qualitative year-by-year projections.
- A dashboard with stage counts, overdue/upcoming follow-ups, missing owners/actions, and scoped recent activity with exact pagination.
- Six evaluation attributes, each an integer 1–5 or explicit N/A. One entry per evaluator per season, author-only edits, attribute-specific averages excluding N/A, and a paginated comparison table visible before your own submission.
- Optional season outcomes separate from stages, previous-season context, confirmed season closure, and adding the same person to a later season with fresh workflow and evaluations.
- Trusted, immutable activity generated in the same transaction as important field changes. Version checks reject stale workflow, outcome and evaluation saves.

Closed seasons retain workflow, outcomes and evaluations and reject seasonal edits. Shared person facts remain current values across years; they are not historical snapshots. Ordinary clients cannot delete or move history or approve leadership.

## Phase 7 — data and portfolio

The private import script validates a UTF-8 CSV and defaults to a no-write check. It can prepare owner-readable private SQL for a one-to-ten-row atomic import. Approval checks, active-season locks, explicit duplicate resolution and private retry receipts protect imports. Unknown facts remain null; workflow, projections and ratings are never invented. Source CSVs and generated SQL do not belong in this public repository.

**The ten-real-prospect import is pending:** no designated recruiting source file or target season was supplied. Hosted verification used ten synthetic rows and rolled everything back; it is not a real import.

The self-contained **read-only synthetic demo** uses ten fictional people and two sample seasons. It has no database, Auth client, import or write endpoint, and does not bypass the private app’s authorization. Its dates use a fixed sample day. After this PR deploys, open `/demo/` on the existing app; its generated directory can also be served independently without any app credentials. See [demo setup](docs/DEMO.md).

![Selected-season dashboard using wholly synthetic test records](docs/images/dashboard-desktop.png)

## Development

Requires Node 22+ and npm. Private import tooling and its tests require Python 3.11+. Dependency versions and the lockfile are unchanged.

```sh
npm ci
npm run dev
npm run test
npm run typecheck
npm run build
npm run test:runtime
```

`predev` and `prebuild` generate the isolated demo from `demo/` into ignored `public/demo/`. To serve only the demo, without the private app:

```sh
npm run build:demo
python3 -m http.server 3001 --directory public/demo
```

Copy `.env.example` to `.env.local`, fill its values, and use a modern publishable Supabase key. Never supply a secret/service-role key to the app. Missing or invalid configuration fails closed; `APP_ENV=demo` still cannot enter the private workspace. The static demo does not need those variables.

[Setup](docs/SETUP.md) · [Scope](docs/SCOPE.md) · [Verification](docs/VERIFICATION.md). GitHub Actions runs checks against isolated synthetic providers and retains browser captures. Hosted permission scripts roll back all fixtures. Existing Supabase project `ldrdsvsmwnjzhyzqdcdt` and Vercel infrastructure are preserved; applied migrations must not be reapplied.

## Privacy and boundaries

This repository contains source and deliberately synthetic portfolio assets, not a recruiting dataset. Never commit real names, contacts, ratings, credentials, private exports, generated import SQL or private screenshots. Private inputs belong outside the repository or in ignored `data/private/`. Demo fixtures are authored independently; they are never anonymized copies of real prospects.

Stop after Phase 7. Notes, manual interaction entries, notifications, AI features, and tryout/roster management remain outside this phase.
