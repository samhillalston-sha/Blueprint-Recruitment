# Phase 1 setup

## Existing infrastructure

- Repository: `samhillalston-sha/Blueprint-Recruitment` (public source only).
- Supabase project: **Blueprint Recruiting**, region `us-east-1`.
- Project reference: `ldrdsvsmwnjzhyzqdcdt`.
- Dashboard: https://supabase.com/dashboard/project/ldrdsvsmwnjzhyzqdcdt

Only the Phase 1 foundation migration has been applied. It creates `profiles` and `seasons`, seeds 2026/2027, and defaults all profiles to inactive. Do not apply the same migration twice. Other Supabase projects are unrelated and must not be modified.

## Required Auth configuration

1. In Supabase Auth, keep email sign-in enabled, disable public signup and anonymous sign-in. The app also sends `shouldCreateUser: false`; database authorization remains restrictive even if signup is accidentally enabled.
2. Set Site URL to the exact `APP_URL`. Add the exact local/deployed `/auth/callback` and `/auth/confirm` URLs to allowed redirects. Avoid wildcard production redirects.
3. Set up an email provider suitable for leadership email delivery before inviting team members. Supabase's default SMTP is intended for limited testing and restricts recipients; successful delivery to your team has not been verified.
4. Invite only approved leadership addresses through Supabase Auth. New profiles are created inactive. Activate each invited profile by its verified Auth user ID through the dashboard, and set its full name. Never give ordinary clients permission to activate profiles.
5. Test one approved account end-to-end, including sign-out and access revocation, before distributing the app.

No invitations have been sent and no leadership account has been activated by this implementation. These are administrator setup steps, not a self-signup flow.

## Email callback options

The default magic-link template redirects through Supabase to `/auth/callback?code=...`. The server exchanges the PKCE code and rechecks leadership access. Open this link in the same browser that requested it so the verifier cookie is available.

For direct token-hash links (including leadership invitations), configure your own SMTP provider and use these template destinations:

```html
<!-- Magic link -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to Blueprint Recruiting</a>
<!-- Invitation -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept invitation</a>
```

Both callback routes ignore user-controlled `next` values, use the canonical configured origin, and check active leadership before entering the workspace. Token-hash templates work across browsers because they don't require the original PKCE verifier.

New Free projects created after June 3, 2026 cannot customize templates while using Supabase's default email provider. Custom SMTP unlocks template customization. See [Supabase's change notice](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) and [SSR passwordless documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Vercel

Connect this repository, choose Next.js, and add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, and `APP_ENV=private`. Never add a service-role key. Update Supabase URL configuration to the actual deployed origin. Reconfigure separate preview URLs explicitly; don't reuse real data in public demo deployments.

## Revoking access

Set a leadership profile's `is_active` to false. Subsequent guarded page requests and database season reads fail closed even if the Auth session remains valid. This is preferable to relying on stale user-editable JWT metadata. Removing a user alone is not a guarantee that issued tokens are invalidated; use appropriate Auth session revocation as well.

## Remaining manual checks

This connector supports project/database operations, but does not expose Auth settings, SMTP setup, or leadership invitations. They must be completed in the Supabase dashboard. No production deployment or real-inbox sign-in is claimed by automated tests.
