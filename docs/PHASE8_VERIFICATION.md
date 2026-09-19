# Phase 8 verification

Phase 8 adds no recruiting behavior. It verifies the merged application across server policy, hosted Postgres, a production Next.js process, hydrated browsers, and the deployed anonymous surface. All database fixtures and screenshots are synthetic. Deployment checks are read-only and never enter the private production workspace.

## Coverage matrix

| Area | Evidence |
| --- | --- |
| Authentication and authorization | Unit and runtime tests validate server-side getUser, Google PKCE, callback origin/provider constraints, anonymous denial, inactive/missing-profile denial, immediate revocation, sign-out and fail-closed provider errors. Hosted SQL independently checks RLS and grants for anonymous, approved, inactive, revoked and missing-profile identities. |
| Core workflow | Runtime and hydrated-browser stories cover people, duplicate warnings, seasonal workflow, dashboard queues, activity, evaluations with N/A, outcomes, closure and reuse in a later season. Stale and captured actions are rejected. |
| Data isolation | Hosted SQL verifies own-profile visibility, seasonal separation, immutable activity, author-owned evaluation writes, closed-season freezes, private import receipts and no client access to private helpers. Every fixture transaction rolls back. |
| Responsive layout | Hosted browser stories cover the private workspace and static demo at desktop and 390×844. Phase 8 adds explicit desktop/mobile login, empty-dashboard and error-boundary captures with document-width assertions. |
| Empty and error states | Native/runtime tests distinguish empty lists, empty dashboard queues, no activity and no evaluations from provider outages. Hydrated browser coverage confirms the error boundary never substitutes fabricated empty results. |
| Production and demo | npm run verify:deployment checks the HTTPS login, security headers, anonymous redirects for all private route families, the ten-person static demo and the 404 page. It performs no sign-in or writes. |

## Commands

```sh
npm ci
npm run test
npm run typecheck
npm run build
npm run test:runtime
npm run verify:deployment
```

Pass a preview or alternate production origin as the final argument:

```sh
npm run verify:deployment -- https://deployment.example
```

The deployment verifier requires HTTPS and only reads public/anonymous routes. Authenticated production access remains a manual confirmation because automated verification deliberately has no leadership cookie or Google credentials.

## Boundaries

- A successful anonymous deployment smoke test proves that the login is configured, private routes redirect, and the isolated demo is available. It does not prove a particular Google account is approved.
- Browser workflow tests run against the production build with a synthetic Supabase-compatible provider. They exercise unchanged application authorization code but do not touch production records.
- Hosted database scripts prove policies and invariants against the real schema using temporary synthetic rows. They do not validate UI rendering and never commit their fixtures.
- The real ten-prospect population is user-managed and is not inspected, exported or captured by Phase 8.
