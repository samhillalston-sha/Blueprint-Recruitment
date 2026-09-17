# Blueprint Recruiting working agreement

- Implement only the phase explicitly authorized by the user. Phase 1 is deployed and user-confirmed; Phase 2 prospect records are authorized. Stop before Phase 3.
- Preserve the standard Next.js + Supabase stack and existing Vercel deployment. Inspect existing infrastructure; do not recreate it.
- Google sign-in is the approved login method; no SMTP/domain purchase is required. Keep workspace access approval-only and fail closed. New Google Auth accounts default to inactive leadership profiles. Verify identities server-side, then check the current active leadership profile. Never authorize from user-editable metadata or an unverified session cookie.
- Individual leadership Google accounts must represent individual authors. A team-owned Google account can own infrastructure, but shared application logins must not be the default onboarding model.
- Enable RLS and explicit minimal grants on every exposed table. No ordinary client may activate leadership membership.
- Never commit real prospect/player data, private exports, credentials, or private-workspace screenshots. Test fixtures and future portfolio demos must be wholly synthetic and isolated.
- Do not invent recruiting counts or present placeholder screens as operational features.
- Persistent prospect facts are shared across seasons; candidacies preserve distinct season membership. Reuse profiles rather than copying people. Historical seasons are read-only in the application. No client may delete or move history.
- Ratings are shared with leadership even before a member submits their own. Position options are only Handler/Cutter. Keep recruiting stage separate from season outcome when future phases are authorized.
- After changes, run `npm run test`, `npm run typecheck`, `npm run build`, and `npm run test:runtime`. Report unavailable checks honestly. Database changes also need hosted permission checks and Supabase advisors.
- GitHub `samhillalston-sha/Blueprint-Recruitment` is the durable source of truth. Check current remote state before restoring or publishing from an ephemeral workspace.
