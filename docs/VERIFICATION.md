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

## Limits recorded at Phase 3 completion

- Vercel connector lists no teams; Phase 3 preview deployment inspection returned 403 for scope `blueprint-5769`. Existing infrastructure was not recreated. Authenticated production Phase 3 verification remains unavailable through that connector.
- No real prospect data was imported or committed. Tests contain synthetic people only.
- Shared person facts are current values across all seasons, not historical fact snapshots.
- Duplicate detection is a warning, not a name uniqueness constraint. Same-name people are permitted; simultaneous writes may race.
- Activity logging begins with the Phase 3 migration, including writes by the existing Phase 2 forms. No retrospective field history is claimed. Clients cannot modify events; privileged database administrators retain their normal infrastructure powers.
- Projections are qualitative text, not ratings or roster composition modeling. Follow-up dates do not send reminders or notifications.
- At Phase 3 completion, Phase 4 and later features remained excluded. PR #2 has since been merged; the user subsequently authorized Phase 4.

## Phase 4 — September 18, 2026

Started from merged main `5d8ede7`, after reviewing AGENTS.md, README and project docs and inspecting existing migration history, exposed functions and table RLS. Phase 3 PR #2 is merged. Phase 4 stops before Phase 5.

Applied additive migration `20260917213220_phase_four_dashboard.sql` to existing project `ldrdsvsmwnjzhyzqdcdt`. It adds a read-only, guarded security-invoker dashboard RPC; no existing infrastructure, table policies, history or records are replaced. Counts and pages share one database snapshot. Each queue is bounded to ten rows and retains an exact total beyond API row limits.

Local verification: 30 unit tests passed; typecheck and production build passed; 30 runtime tests passed, with two optional browser tests skipped locally because of sandbox browser socket restrictions. The new runtime coverage checks exact stage/queue counts, today's UTC boundary, whitespace-only actions, season/shared-event isolation, independent pagination, clamped pages, historical context, and provider errors without fabricated empty states.

Hosted `tests/phase-four-access.sql` passed, including 16 synthetic seasonal prospects, date boundaries, null/empty/whitespace actions, exact counts, bounded pagination, malformed and out-of-range pages, shared facts and historical activity, unavailable seasons, no writes during reads, own-only full profiles, caller RLS, and anonymous/inactive/missing/revoked denial. Phase 1, 2 and 3 hosted access regression scripts also passed. All synthetic fixtures rolled back.

Supabase advisors show no new security issues: the existing [leaked-password warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains with Google-only sign-in settings unchanged, plus [unused-index informational notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). All five existing public tables retain RLS.

[GitHub Actions run 35289431838](https://github.com/samhillalston-sha/Blueprint-Recruitment/actions/runs/35289431838) passed on application commit `496042f59beb3d14a362b52f8bd6acb102ecee16`: 30 unit tests, typecheck, production build, and **32 runtime/browser tests with zero failures or skips**, including both interactive browser tests. Four synthetic desktop/mobile artifacts were retained. Follow-up changes scope the dashboard prospect selector to the first row and capture full pages for review; application behavior is unchanged.

[Phase 4 PR #3](https://github.com/samhillalston-sha/Blueprint-Recruitment/pull/3) records the latest hosted CI/browser results. CI runs both interactive browser tests: the existing workflow regression and the new dashboard desktop/mobile test. The dashboard test checks all widgets, queue pagination, season-preserving profile navigation, historical context, mobile width, browser errors, and the hydrated error boundary on provider failure. Captures contain only synthetic records.

GitHub reported a successful Vercel preview build for initial application commit `496042f59beb3d14a362b52f8bd6acb102ecee16`. Direct Vercel inspection remains blocked by HTTP 403 for team scope `blueprint-5769`; no infrastructure is recreated. Authenticated production testing is not claimed. No real prospect data, credentials, private exports or private screenshots are committed.

## Phase 5 — September 18, 2026

Started from merged main `e640e7655805975729ba7dc6a7f192d7e42edb18` after reading the working agreement and project docs and inspecting existing tables, RLS, activity constraints and migration history. Phase 4 PR #3 is merged. Phase 5 stops before Phase 6.

The CLI-created additive migration `20260918011509_phase_five_evaluations.sql` is applied to existing project `ldrdsvsmwnjzhyzqdcdt`; its filename matches the hosted recorded version. It adds seasonal author-owned evaluations, exact all-evaluator averages and paginated comparison under caller RLS, protected authorship/name/version/timestamps, and atomic activity. Existing infrastructure, approvals, prospect facts and season history are preserved. No retrospective evaluations are fabricated.

Local verification passed: 33 unit tests, typecheck, production build and 36 runtime tests. Three optional browser tests are skipped locally because the sandbox blocks browser sockets. CI runs the existing workflow and dashboard regressions plus a new interactive evaluation story. The new story reads another evaluator before submission, saves N/A and numeric ratings, edits and checks averages/activity, verifies historical isolation, checks mobile page width and comparison-container scrolling, checks browser errors and retains full synthetic desktop/mobile captures. The runtime test timeout is 120 seconds to accommodate three browser stories; dependency versions and lockfile are unchanged.

Hosted `tests/phase-five-access.sql` passed: no fabricated unsubmitted scores, visibility before own submission, six attributed ratings, per-attribute denominators and all-N/A handling, author-only writes and spoofing denial, unique authorship, version/no-op behavior, trusted audit events and atomic rollback, no client history deletion/move, former-evaluator retention, independent historical scores, 29-evaluator pagination with full averages and own row outside the page, malformed/out-of-range pages, own-only full profiles, historical/closed-season denial, and anonymous/inactive/revoked/missing-profile denial. Phase 1–4 access regressions also passed. All fixtures rolled back; no synthetic Phase 5 accounts, seasons or prospects remain.

Security advisors report only the existing [Auth leaked-password warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance notices are [unused-index information](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index); retain indexes for owner, follow-up, evaluator and foreign-key lookups.

The Phase 5 PR records final hosted CI/browser results and preview status. Direct Vercel inspection previously returned 403 for team scope `blueprint-5769`; authenticated production verification is not claimed. Only synthetic fixtures/captures are used. No real evaluations, prospect data, credentials or private exports are committed.
