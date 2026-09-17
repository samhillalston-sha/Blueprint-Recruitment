# Setup — existing Google sign-in and Phase 2

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
