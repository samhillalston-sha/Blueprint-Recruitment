# Setup — existing Google sign-in and Phase 6

## Existing infrastructure

- Repository: `samhillalston-sha/Blueprint-Recruitment` (public source only).
- Supabase project: **Blueprint Recruiting**, region `us-east-1`.
- Project reference: `ldrdsvsmwnjzhyzqdcdt`.
- Dashboard: https://supabase.com/dashboard/project/ldrdsvsmwnjzhyzqdcdt

The hosted Phase 1 migration creates `profiles` and `seasons`, seeds 2026/2027, and defaults all new profiles to inactive. It is already applied; do not apply it twice or modify unrelated projects.

## No email provider or purchased domain

The approved login method is now **Sign in with Google**, not emailed magic links. It does not need a custom SMTP provider, paid mailbox, or purchased domain. The app may use the hosting provider's generated address. Hosting/database free tiers still have limits; this is not a promise of unlimited free service.

Supabase handles Google's identity exchange. The application receives a one-time code, exchanges it through the cookie-based PKCE flow, freshly verifies identity, and checks an active leadership profile before rendering private screens.

## Individual users versus team ownership

Use a team-owned Google account to own the Google Cloud/OAuth configuration if desired. **Each leadership member should sign in with an individual Google account.** Shared application credentials collapse ownership, notes, and future evaluations into one author and make per-person access revocation impossible. Never send a shared account password or OAuth client secret through chat, or commit them to source control.

## One-time Google setup (manual)

1. Open [Google Cloud Console](https://console.cloud.google.com/) under the account that will own this application. Create/select a project for Blueprint Recruiting. No paid APIs are needed for basic Google identity login.
2. Configure Google Auth Platform: an app name and support email, External audience for ordinary Google accounts, and only the `openid`, email, and profile scopes. Do not request Gmail, Drive, Calendar, or other sensitive permissions. While using testing mode, add the approved leadership accounts as test users.
3. Create an OAuth client of type **Web application**.
4. If adding Authorized JavaScript origins, use the exact app origin (`http://localhost:3000` for local testing; later the actual deployed origin).
5. Add this exact **Authorized redirect URI** to the Google OAuth client:

   ```text
   https://ldrdsvsmwnjzhyzqdcdt.supabase.co/auth/v1/callback
   ```

   This is Supabase's callback, not the application's `/auth/callback` route.
6. Copy the OAuth client ID and secret directly into [Supabase's Google provider settings](https://supabase.com/dashboard/project/ldrdsvsmwnjzhyzqdcdt/auth/providers), enable Google, and save. Leave nonce verification enabled. These credentials belong in Supabase, not the app's browser bundle, repository, or chat.

The available connectors do not manage Google Cloud OAuth clients or Supabase Auth provider settings. The user completed the setup and confirmed live Google sign-in, manual leadership approval, and dashboard access on September 17, 2026. These instructions remain as an onboarding reference.

## Supabase Auth configuration

1. Disable the email/password provider and anonymous sign-in. Google should be the enabled login provider; email invitations and email confirmation templates are not part of this workflow.
2. Allow new Google identities to register so approved leaders can make their first sign-in. A Supabase Auth account is **not** leadership approval: the profile trigger creates every account inactive, and both the application and RLS deny recruiting-workspace access until an administrator activates its profile. The global "Allow new users to sign up" switch must not block first-time Google users for this approval model.
3. Set Site URL to the exact canonical `APP_URL`. Add the exact application `/auth/callback` URLs for local and deployed environments to the redirect allow list. Avoid wildcard production redirects.
4. Have an approved leader complete Google sign-in once. Initially they will see an access-approval notice. In Supabase Auth Users, verify their individual email/user ID. Locate that exact ID in `public.profiles`, set `is_active=true`, and set their display name. The administrator performs this through the dashboard; clients have no profile write privileges.
5. The leader signs in again and can now enter the workspace. Repeat only for approved leadership. There is no automatic first-user admin, editable metadata activation, or Gmail-domain-wide access grant.

The callback ignores user-controlled `next` destinations and uses the configured canonical origin. OAuth start explicitly prompts for account selection and asks only for identity scopes. A rejected or inactive account is signed out locally at the callback.

## App environment and deployment

Use `SUPABASE_URL`, a modern `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, and `APP_ENV=private` from `.env.example`. No Google OAuth secret or Supabase service-role key is needed in the application.

For Vercel, connect the repository, choose Next.js, supply those variables, and use the actual generated or custom app origin in Supabase URL settings. Phase 1 is deployed at https://blueprint-recruitment.vercel.app; the user confirmed access. Use its exact origin for APP_URL and its exact /auth/callback URL in the Supabase allow list. Keep public portfolio demos isolated and wholly synthetic.

## Revocation and final live test

Set a user's profile `is_active=false` to remove their access on subsequent guarded page requests and database reads without waiting for a JWT metadata refresh. Use Auth session revocation as appropriate too; deleting an Auth user alone is not a guarantee that issued tokens are invalidated.

Before distributing the app, test with an approved individual Google account: provider redirect, consent/account selection, first-sign-in denial, manual approval, successful sign-in, local sign-out, revocation, and access denial for a non-leader. Automated tests use an isolated synthetic provider and do not establish that the real Google client configuration works.

Reference: [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Phase 2 database

The additive migration `20260917203540_phase_two_prospect_records.sql` is already applied to the same project. Do not recreate infrastructure or reapply migrations.

- `prospects`: shared person facts, normalized name lookup, protected creator, creation/update timestamps.
- `candidacies`: one unique membership per prospect/season, protected creator and timestamp. Distinct memberships preserve history; records cannot be deleted or moved by ordinary clients.
- Both tables have RLS; active leadership can read. Only active leadership can write shared person facts or add memberships to active seasons. Column grants exclude authors and timestamps from client writes.
- `create_prospect` is a security-invoker RPC. Person creation and season membership succeed or roll back together under the caller's RLS policies.
- No credentials, real people, or imports are part of the migration.

To reuse a person, browse All people, open their profile in an active season, then Add to this season. Duplicate warnings link to existing profiles. Creating a separate same-name person requires explicit confirmation. Facts are shared across seasons; season history is membership history, not a snapshot of every fact.

## Phase 3 database and workflow

The additive migration `20260917210550_phase_three_recruiting_workflow.sql` is applied on the same existing project. It preserves existing prospect and season records. Do not reapply it. No new infrastructure or application secrets are required.

- `candidacies` now stores stage, optional priority/owner/next action/follow-up date, three qualitative projections, a protected version, and updated timestamp. Client update grants cover only workflow fields; active leadership can edit only active seasons.
- `recruiting_leaders()` exposes only IDs, display names, and active status to approved leaders. Full profiles and emails remain own-only. The private privileged helper checks current approval. Revoked owners remain available for interpreting existing records; they cannot receive new assignments.
- `prospect_activity` is read-only to active leadership. Private trigger functions record trusted authorship and field differences in the same transaction as a mutation. Client insert/update/delete and direct trigger execution are denied.
- Existing candidacies start at Unknown Prospect with unknown optional fields blank. No retrospective events are fabricated. Logging starts when the migration is applied, including writes by the existing Phase 2 forms.

On an active-season profile, save recruiting details. Follow-up dates are calendar dates with UTC status labels, not notifications. Projection labels use the selected season year and the next two years. The activity timeline spans seasons, 25 events per page. Historical workflow fields are read-only.

If another leader edits a candidacy after you open it, saving is rejected. Use Reload profile to review the current record before entering your changes again. Ownership can be cleared or reassigned if a member loses approval; existing ownership history remains intact.

Verify hosted permissions with `tests/database-access.sql`, `tests/phase-two-access.sql`, and `tests/phase-three-access.sql`. All use isolated synthetic fixtures and roll back. Never use real prospect records as test fixtures.

## Phase 4 dashboard

The additive `20260917213220_phase_four_dashboard.sql` migration is applied to the existing project. Do not reapply it. It adds only `recruiting_dashboard(season_id, pages)`, a read-only security-invoker RPC with an empty search path, current leadership guard, existing caller RLS, and authenticated-only execution. No tables, policies, records, credentials or infrastructure are replaced.

The RPC returns exact counts and ten-row pages from one snapshot. Today is UTC; upcoming includes today. Missing actions includes whitespace. Recent activity is scoped to season membership and includes shared-fact updates, without including another season’s workflow events. Invalid pages default to the first page; out-of-range pages clamp to the last page. Dashboard errors use the workspace error boundary instead of displaying invented zero totals.

Run `tests/phase-four-access.sql` alongside the earlier hosted permission scripts. All fixtures roll back. Phase 4 PR #3 is merged; deployments use the existing Vercel GitHub integration. No new environment variables are needed.

## Phase 5 evaluations

Migration `20260918011509_phase_five_evaluations.sql` is applied to the same project; do not reapply it or recreate infrastructure. It adds RLS-protected `evaluations`, author-only score grants, private guarded attribution/logging triggers, and an authenticated-only security-invoker `evaluation_summary` RPC. It extends the existing activity event types for evaluation submissions and changes. No new application secrets or environment variables are needed.

Open a prospect in an active season, choose 1–5 or N/A for all six attributes, and submit. Your saved evaluation can be updated; other leaders' evaluations are read-only. Blank initial choices indicate not submitted, whereas saved null ratings indicate explicit N/A. Closed-season evaluations are read-only. Reload before retrying if another tab changed your evaluation.

Averages exclude N/A and show each attribute's rated/N/A counts. The comparison table displays individual scores and trusted evaluator-name snapshots; it scrolls within its container on mobile and is paginated at 25 evaluators. Summary averages include all submitted evaluations, including former evaluators, independently of pagination. Names are captured at submission; full leadership profiles and emails remain own-only. Database triggers log rating changes atomically and suppress no-op events.

Verify hosted permissions with `tests/phase-five-access.sql` alongside the Phase 1–4 scripts. Every fixture is synthetic and rolls back. Merge the Phase 5 PR to deploy using the existing GitHub/Vercel integration. The user subsequently authorized Phase 6.


## Phase 6 historical continuity

Additive CLI-created migration `20260918013604_phase_six_historical_continuity.sql` is applied to the same existing Supabase project. Do not reapply it or recreate infrastructure. It adds nullable candidacy outcomes and nullable trusted season-closure metadata, extends the existing atomic activity logger, and provides authenticated-only security-invoker `start_season` / `close_season` wrappers around narrowly guarded private helpers. Existing RLS and direct season-write restrictions remain. No new environment variables are required.

On a prospect profile, save an outcome separately from recruiting stage. Blank means not recorded. Previous recorded season context links to historical workflow, projections and evaluations; facts remain shared current values. Outcome and workflow forms share the candidacy version, so saving one makes any already-open older form stale; reload before saving that form.

In Settings, start a later season to create an empty active current season. Other seasons remain active until explicitly closed. To close an active season, type its exact year and click its Close button. Closure records the acting leader’s ID/name and UTC timestamp, waits for in-flight seasonal writes, then blocks further seasonal changes. Missing outcomes remain unset; nothing is removed, cleared or copied. Closed seasons have no app reopen action. The original historical season keeps an unknown closure date/author. If the current season closes, the default selection prefers the latest remaining active season; if none remain, it uses the latest historical season.

To recruit someone again, open an earlier profile and use Add to [later year]. It reuses their person record and creates only a fresh membership; workflow, outcomes, projections and evaluations start empty. Membership uniqueness makes repeated requests safe. You can also select an active season and use the existing Add to this season button. If no eligible new season exists, the historical profile links to Settings.

Run `tests/phase-six-access.sql` and the Phase 1–5 permission scripts; all fixtures are synthetic and rolled back. Phase 6 is based on the unmerged Phase 5 branch: merge PR #4 first, then merge the dependent Phase 6 PR after its checks pass. Deployment uses the existing GitHub/Vercel integration. Stop before Phase 7.
