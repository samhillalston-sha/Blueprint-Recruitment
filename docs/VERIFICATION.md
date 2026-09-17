# Verification

## Phase 1 baseline

The user confirmed the deployed Phase 1 Google sign-in, manual leadership approval, and dashboard access at https://blueprint-recruitment.vercel.app on September 17, 2026. Earlier reports calling these pending are superseded. Other live scenarios such as revocation were not claimed as user-tested.

## Phase 2 — September 17, 2026

The existing repository and hosted profiles/seasons migration were inspected before changes. The additive migration `20260917203540_phase_two_prospect_records.sql` is applied on the existing project.

Hosted `tests/phase-two-access.sql` passed: anonymous/inactive/missing/revoked access denial, active create/read/edit, protected authorship, no history deletion/movement, unique memberships, closed-season membership denial, atomic rollback on failed creation, position/link constraints, and reuse across three seasons. All synthetic fixtures rolled back.

Security advisor: no RLS findings. Auth warning: leaked password protection disabled ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); Google is the approved login method and Auth configuration was not changed. Performance advisor reports unused indexes on new empty tables ([reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)); retain useful season and foreign-key indexes.

Application checks passed in [GitHub Actions run 35272674967](https://github.com/samhillalston-sha/Blueprint-Recruitment/actions/runs/35272674967) on code commit `8406f20dc87a38abd00c83698439e0f88abc1add`:

| Check | Result |
| --- | --- |
| npm ci | Passed; audit reported zero vulnerabilities |
| npm run test | 23 passed |
| npm run typecheck | Passed |
| npm run build | Passed |
| npm run test:runtime | 21 passed |
| Hosted Phase 1 permission regression | Passed, all fixtures rolled back |
| Hosted Phase 2 permission checks | Passed, all fixtures rolled back |

Runtime integration uses the real production Next.js server with isolated synthetic Supabase HTTP fixtures. It covers existing Google/access behavior plus prospect listing/search, facts/profile/history, invalid and missing profiles, duplicate warnings without writes, explicit same-name confirmation, creation/editing, validation denial, historical read-only screens, inactive captured-action denial, provider failures, and reusing a person across seasons. Stable server-bound actions and a season permalink preserve validation state before JavaScript loads. This session has no local command runner; results come from hosted Actions, not local execution.

After hosted SQL tests, prospects, candidacies, and synthetic Phase 2 Auth users each had zero rows. Existing real leadership was preserved. Vercel Git checks reported successful previews on earlier commits; direct connector inspection remains blocked, and no authenticated preview/browser behavior is claimed.

## Limits

- Vercel connector lists no teams; project inspection returned 403. Existing infrastructure was not recreated or changed. Production Phase 2 deployment is not claimed.
- No browser is available in this session; visual and interactive browser QA is not claimed.
- No real prospect data was imported or committed. Tests contain synthetic people only.
- Shared person facts are current values across all seasons, not historical fact snapshots.
- Duplicate detection is a warning, not a name uniqueness constraint. Same-name people are permitted; simultaneous writes may race.
- Phase 3 workflows are excluded. Dashboard pipeline counts remain unconnected.
