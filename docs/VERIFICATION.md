# Phase 1 verification

Reconstruction date: September 16, 2026.
Google sign-in update verified: September 17, 2026.

## Passed checks

| Check | Result |
| --- | --- |
| Fresh install from committed lockfile (`npm ci`) | Passed September 16; dependencies unchanged for Google update |
| Unit tests (`npm run test`) | 20 passed |
| TypeScript (`npm run typecheck`) | Passed |
| Production compilation (`npm run build`) | Passed |
| Production-server integration (`npm run test:runtime`) | 14 passed |
| Hosted database role tests (`tests/database-access.sql`) | Passed; synthetic fixtures rolled back |
| Supabase security/performance advisors | No findings |
| Production dependency audit (`npm audit --omit=dev`) | No vulnerabilities |

Runtime checks start the real production Next.js server against an isolated synthetic Supabase HTTP fixture. Application identity verification, profile lookup, server actions, and route guards run unchanged. Tests cover Google login rendering/security headers, anonymous and file-like private paths, authorized screens, historical/invalid seasons, inactive/missing/revoked leadership, database-provider failures, native Google OAuth initiation with persisted PKCE verifier and canonical callback, account-selection prompt, minimal identity scopes, sign-out, successful/denied code exchange, provider cancellation, and rejection of untrusted redirect targets. The former emailed-token confirmation endpoint is removed and tested as unavailable.

Hosted SQL checks ran on the real Blueprint Recruiting project. They verify the Auth profile trigger ignores metadata activation, anonymous reads fail, leadership can read only its own profile, only active leadership sees seasons, client writes and private function calls fail, and invalid season constraints are rejected. Afterwards, the database contained zero leadership profiles, zero synthetic Auth users, and exactly the two configured seasons.

The migration filename is aligned with the version recorded by the hosted migration API (`20260916161318`). Only `profiles` and `seasons` exist in the public application schema; both have RLS enabled.

## Setup and verification limits

- **Browser visual/interaction QA is blocked.** Playwright's Chromium download failed with a proxy 502 and repeated timeouts. No browser screenshot/responsive-layout verification is claimed. Runtime checks establish server behavior, not browser pixel correctness.
- This environment restricts network-interface inspection. Default `next start` failed while trying to discover a network hostname; the production integration suite successfully starts it with the documented `--hostname 127.0.0.1` option. Server and fixtures run in one test process, avoiding isolated-loopback issues between tool calls.
- **Live Google sign-in is not verified.** Google Cloud OAuth client creation, Google provider credentials in Supabase, and individual leadership profile approval still require dashboard setup. Connector capabilities do not expose those administrative operations. No purchased domain, custom SMTP provider, or emailed invitation is required for the approved Google workflow.
- The first build after this change hit an internal Turbopack persistence-cache panic. The previous generated `.next` directory was moved to a temporary recovery folder, not deleted; a clean rebuild succeeded. No source files or user data were lost.
- **Vercel deployment is pending.** No deployed production URL is available or represented as verified.
- GitHub Actions is configured to repeat install, unit tests, typecheck, build, and runtime checks without credentials. Its hosted run is not claimed as passed by this local report.

See [setup instructions](SETUP.md). Stop here: Phase 2 is not authorized by this checkpoint.

No production deployment, real Google consent/account login, administrator approval, or prospect workflow is represented as verified. OAuth behavior is tested using synthetic fixtures, not real Google credentials. No Google/Supabase provider settings or actual leadership access were changed by the code update.
