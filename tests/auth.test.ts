import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAccess, isProtectedPath, loginReason, type LeadershipProfile } from "../src/lib/auth/policy";
import { authorizeClient } from "../src/lib/auth/authorize";
import { googleOAuthOptions, safeGoogleOAuthUrl } from "../src/lib/auth/sign-in";
import type { SupabaseClient } from "@supabase/supabase-js";

const profile: LeadershipProfile = { id: "member", full_name: "Demo Captain", email: "captain@example.com", is_active: true };
test("anonymous requests never read profiles", async () => {
  let calls = 0;
  assert.deepEqual(await evaluateAccess(async () => null, async () => { calls++; return profile; }), { status: "unauthenticated" });
  assert.equal(calls, 0);
});
test("verified active leadership is admitted", async () => {
  const result = await evaluateAccess(async () => ({ id: "member" }), async () => profile);
  assert.equal(result.status, "authorized");
});
test("inactive leadership is denied", async () => {
  assert.deepEqual(await evaluateAccess(async () => ({ id: "member" }), async () => ({ ...profile, is_active: false })), { status: "denied" });
});
test("missing or mismatched profiles are denied", async () => {
  for (const record of [null, { ...profile, id: "other" }]) {
    assert.deepEqual(await evaluateAccess(async () => ({ id: "member" }), async () => record), { status: "denied" });
  }
});
test("auth or database outages fail closed", async () => {
  assert.deepEqual(await evaluateAccess(async () => { throw Error("offline"); }, async () => profile), { status: "unavailable" });
  assert.deepEqual(await evaluateAccess(async () => ({ id: "member" }), async () => { throw Error("offline"); }), { status: "unavailable" });
});
test("all private subtrees include extension-like and nested paths", () => {
  for (const path of ["/dashboard", "/dashboard/history", "/prospects/a.json", "/settings/members"]) assert.equal(isProtectedPath(path), true);
  for (const path of ["/login", "/auth/confirm", "/prospects-public", "/favicon.svg"]) assert.equal(isProtectedPath(path), false);
});
test("redirect reasons expose no private details", () => {
  assert.equal(loginReason("unauthenticated"), "signin");
  assert.equal(loginReason("denied"), "access");
  assert.equal(loginReason("unavailable"), "unavailable");
});
test("Google requests only identity scopes, uses a fixed callback, and prompts for an individual account", () => {
  assert.deepEqual(googleOAuthOptions("https://blueprint.example.com"), { redirectTo: "https://blueprint.example.com/auth/callback", skipBrowserRedirect: true, scopes: "openid email profile", queryParams: { prompt: "select_account" } });
});
test("OAuth redirects accept only the configured Supabase Google authorization endpoint", () => {
  const origin = "https://blueprint.example.com";
  const base = "https://project.supabase.co";
  const url = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${origin}/auth/callback`)}`;
  assert.equal(safeGoogleOAuthUrl(url, base, origin), url);
  for (const value of [null, "not a URL", url.replace(base, "https://evil.example"), url.replace("provider=google", "provider=facebook"), url.replace("/auth/v1/authorize", "/other"), `${url}&provider=google`, `${url}#fragment`, url.replace(encodeURIComponent(`${origin}/auth/callback`), encodeURIComponent("https://evil.example"))]) {
    assert.equal(safeGoogleOAuthUrl(value, base, origin), null);
  }
});
test("Supabase adapter validates getUser, not cookie getSession or metadata", async () => {
  let verified = false;
  const client = {
    auth: { getUser: async () => { verified = true; return { data: { user: { id: "member", user_metadata: { is_active: true } } }, error: null }; }, getSession: () => { throw Error("must not trust session"); } },
    from: (table: string) => { assert.equal(verified, true); assert.equal(table, "profiles"); return {
      select: () => ({ eq: (key: string, id: string) => { assert.equal(key, "id"); assert.equal(id, "member"); return { maybeSingle: async () => ({ data: { ...profile, is_active: false }, error: null }) }; } }),
    }; },
  } as unknown as SupabaseClient;
  assert.deepEqual(await authorizeClient(client), { status: "denied" });
});
test("Supabase provider errors are not treated as approved membership", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: { status: 503 } }) } } as unknown as SupabaseClient;
  assert.deepEqual(await authorizeClient(client), { status: "unavailable" });
});
