import { test } from "node:test";
import assert from "node:assert/strict";
import { readRuntimeConfig } from "../src/lib/config";

const valid = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", APP_URL: "https://blueprint.example.com", APP_ENV: "private" };
test("missing configuration fails closed", () => {
  assert.equal(readRuntimeConfig({}), null);
  for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "APP_URL"]) assert.equal(readRuntimeConfig({ ...valid, [key]: "" }), null);
});
test("valid HTTPS configuration normalizes canonical origins", () => {
  assert.deepEqual(readRuntimeConfig({ ...valid, APP_URL: "https://blueprint.example.com/" }), { supabaseUrl: valid.SUPABASE_URL, publishableKey: valid.SUPABASE_PUBLISHABLE_KEY, appOrigin: valid.APP_URL });
});
test("unsafe schemes, credentials, paths, query strings, fragments are rejected", () => {
  for (const url of ["http://blueprint.example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?next=x", "https://example.com#hash", "javascript:alert(1)"]) {
    assert.equal(readRuntimeConfig({ ...valid, APP_URL: url }), null);
  }
});
test("loopback development supports HTTP", () => {
  assert.equal(readRuntimeConfig({ ...valid, APP_URL: "http://localhost:3000" })?.appOrigin, "http://localhost:3000");
});
test("unsupported demo mode cannot bypass private authentication", () => {
  assert.equal(readRuntimeConfig({ ...valid, APP_ENV: "demo" }), null);
});
test("secret/service-role/legacy keys are rejected", () => {
  for (const key of ["sb_secret_example", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x", "legacy-anon", "sb_publishable_bad space"]) assert.equal(readRuntimeConfig({ ...valid, SUPABASE_PUBLISHABLE_KEY: key }), null);
});
