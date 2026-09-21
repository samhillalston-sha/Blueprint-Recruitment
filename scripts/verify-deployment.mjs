#!/usr/bin/env node
import assert from "node:assert/strict";

const target = new URL(process.argv[2] ?? process.env.BLUEPRINT_DEPLOYMENT_URL ?? "https://blueprint-recruitment.vercel.app");
if (target.protocol !== "https:") throw new Error("Deployment verification requires an HTTPS origin.");
target.pathname = "/";
target.search = "";
target.hash = "";

async function request(path, redirect = "manual") {
  return fetch(new URL(path, target), { redirect, signal: AbortSignal.timeout(20_000) });
}

const login = await request("/login");
assert.equal(login.status, 200, "Login page must be available");
const loginHtml = await login.text();
assert.match(loginHtml, /Welcome back/);
assert.match(loginHtml, /Sign in with Google/);
assert.doesNotMatch(loginHtml, /Workspace setup is still in progress/);
assert.match(login.headers.get("cache-control") ?? "", /no-store/);
assert.equal(login.headers.get("x-frame-options"), "DENY");
assert.equal(login.headers.get("x-content-type-options"), "nosniff");
assert.equal(login.headers.get("referrer-policy"), "no-referrer");

for (const path of ["/dashboard", "/prospects", "/settings", "/prospects/private.json"]) {
  const response = await request(path);
  assert.ok([303, 307, 308].includes(response.status), path + " must redirect anonymously");
  const location = new URL(response.headers.get("location"), target);
  assert.equal(location.origin, target.origin, path + " must not redirect off-site");
  assert.equal(location.pathname, "/login", path + " must redirect to login");
}

const demoEntry = await request("/demo");
assert.ok([303, 307, 308].includes(demoEntry.status));
assert.equal(new URL(demoEntry.headers.get("location"), target).pathname, "/demo/index.html");
const demo = await request("/demo/index.html");
assert.equal(demo.status, 200);
assert.match(await demo.text(), /Every name, team, scenario, and rating is invented/);
const data = await request("/demo/data.mjs");
assert.equal(data.status, 200);
const dataset = JSON.parse((await data.text()).replace(/^export const demoData = /, "").replace(/;\n?$/, ""));
assert.equal(dataset.prospects.length, 10);
assert.equal(new Set(dataset.prospects.map(person => person.name)).size, 10);
assert.ok(dataset.prospects.every(person => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(person.name)));
assert.ok(dataset.prospects.every(person => !/Demo Prospect/i.test(person.name)));

const missing = await request("/phase-eight-missing-page");
assert.equal(missing.status, 404);
assert.match(await missing.text(), /isn.t on the blueprint/);

console.log(JSON.stringify({
  origin: target.origin,
  login: "available",
  private_routes: "redirected",
  demo_prospects: dataset.prospects.length,
  missing_page: 404,
}));
