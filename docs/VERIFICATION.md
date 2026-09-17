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

## Phase 3 — September 17, 2026

Phase 2 was merged in [PR #1](https://github.com/samhillalston-sha/Blueprint-Recruitment/pull/1), and the user confirmed the deployed prospect screens. Phase 3 started from main commit `4a0044856a6de20a8a74d9024c6382bd848a70d4`, after reading AGENTS.md and project docs and inspecting existing hosted tables, policies, column grants, and migration history.

The CLI-created additive migration `20260917210550_phase_three_recruiting_workflow.sql` is applied to existing project `ldrdsvsmwnjzhyzqdcdt`; its filename matches the hosted recorded version. It adds seasonal workflow fields, qualitative three-year projections, protected versions/timestamps, a minimal approved-owner directory, and database-triggered activity logging. It preserves existing infrastructure and records without backfilling invented events.

Hosted `tests/phase-three-access.sql` passed. Assertions cover all workflow fields, null defaults, trusted author/name/season attribution and before/after values, automatic shared-fact logging, no-op suppression, version increments, active owner eligibility, revoked-owner retention/clearing, private directory guards, own-only full profiles, immutable client activity, trigger execution denial, constraints, historical read-only access, independent outlooks across three seasons, atomic edit/event rollback, and inactive/revoked/missing/anonymous denial. Phase 1 and Phase 2 hosted permission regressions also passed. Every synthetic fixture rolled back; existing row counts were preserved and no synthetic Auth users remained.

Local checks use Node 24.19.0, unchanged pinned dependencies, and the real production Next.js server with an isolated synthetic Supabase HTTP provider. No application auth bypass or real recruiting data is used.

| Check | Result |
| --- | --- |
| npm ci | Passed; audit reported zero vulnerabilities |
| npm run test | 28 passed |
| npm run typecheck | Passed |
| npm run build | Passed |
| npm run test:runtime | 28 passed |
| Hosted Phase 1, 2, 3 permission scripts | Passed; fixtures rolled back |
| Supabase security advisor | No new findings; existing leaked-password warning only |
| Supabase performance advisor | Unused-index informational notices only |

Phase 3 runtime coverage adds native workflow saves and form validation, list/owner/follow-up display, actual pipeline counts, projection year labels, author/before/after timeline display, no-op behavior, historical workflow isolation, stale edits, invalid owner/date/stage denial, captured actions after revocation/season closure, directory/timeline outages, and activity pagination including out-of-range pages. Database security guarantees are separately tested against hosted Postgres, not inferred from the HTTP fixture.

Local browser launch is blocked by sandbox socket restrictions (`Operation not permitted`). The existing GitHub Actions workflow installs pinned `agent-browser@0.38.1` and enables an additional interactive browser test against the same isolated synthetic provider. It saves all workflow fields with JavaScript loaded, checks activity/list/pipeline persistence and historical read-only views, checks mobile page width and browser errors, and captures desktop/mobile screenshots containing only synthetic data. The local runtime command skips this optional test.

[GitHub Actions run 35275516963](https://github.com/samhillalston-sha/Blueprint-Recruitment/actions/runs/35275516963) passed on application commit `41390791d55471730b3eb013bf3b746c97e1658b`: install/audit (zero vulnerabilities), 28 unit tests, typecheck, production build, and **29 runtime/browser tests with zero skips or failures**. The interactive browser test passed. GitHub reports a successful Vercel preview build for that commit; direct Vercel deployment inspection still returns 403 for scope `blueprint-5769`. Production merge/deployment is not claimed.

The existing Auth leaked-password warning remains ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); Google is the approved login method and Auth settings were not changed. Keep new season, owner, follow-up, timeline, and foreign-key indexes despite unused-index notices on a small database ([reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)).

## Current limits

- Vercel connector lists no teams; Phase 3 preview deployment inspection returned 403 for scope `blueprint-5769`. Existing infrastructure was not recreated. Authenticated production Phase 3 verification remains unavailable through that connector.
- No real prospect data was imported or committed. Tests contain synthetic people only.
- Shared person facts are current values across all seasons, not historical fact snapshots.
- Duplicate detection is a warning, not a name uniqueness constraint. Same-name people are permitted; simultaneous writes may race.
- Activity logging begins with the Phase 3 migration, including writes by the existing Phase 2 forms. No retrospective field history is claimed. Clients cannot modify events; privileged database administrators retain their normal infrastructure powers.
- Projections are qualitative text, not ratings or roster composition modeling. Follow-up dates do not send reminders or notifications.
- Phase 4 and later features remain excluded. Phase 3 frontend reaches production only after the PR is merged and Vercel deploys it.
