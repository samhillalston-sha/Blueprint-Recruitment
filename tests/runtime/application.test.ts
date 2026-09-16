import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

// Isolated synthetic Supabase HTTP fixture, not an application auth bypass.
// Production identity validation and profiles queries run unchanged.
const ids = {
  active: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  inactive: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  missing: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
};
const seasons = [
  { id: "2027", name: "2027 Season", year: 2027, is_current: true, status: "active" },
  { id: "2026", name: "2026 Season", year: 2026, is_current: false, status: "closed" },
];
let fixture: Server;
let app: ChildProcess;
let appOrigin: string;
let providerUnavailable = false;
let profileUnavailable = false;
let revoked = false;
let logs = "";
let validatedIdentities = 0;
let otpRequest: { body: Record<string, unknown>; redirectTo: string | null } | null = null;

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing loopback port");
  return address.port;
}
async function close(server: Server) { await new Promise<void>(resolve => server.close(() => resolve())); }
function user(id: string) { return { id, email: "synthetic-captain@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { is_active: true }, created_at: "2026-01-01T00:00:00Z" }; }
function session(kind: keyof typeof ids) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: ids[kind], aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`;
  return { access_token: token, refresh_token: "synthetic-refresh", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user: user(ids[kind]) };
}
function sessionCookie(kind: keyof typeof ids): string { return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session(kind))).toString("base64url")}`; }
async function get(path: string, kind?: keyof typeof ids, extraHeaders: Record<string, string> = {}) {
  return fetch(`${appOrigin}${path}`, { redirect: "manual", headers: { ...(kind ? { Cookie: sessionCookie(kind) } : {}), ...extraHeaders } });
}
function formFromHtml(html: string, field: string): FormData {
  const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find(match => match[1].includes(field));
  assert.ok(form, `Expected a form containing ${field}`);
  const data = new FormData();
  const decode = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  for (const input of form[1].matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/\bname="([^"]*)"/)?.[1];
    const value = input[0].match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name?.startsWith("$ACTION")) data.append(decode(name), decode(value));
  }
  assert.ok([...data.keys()].length, "Native server action fields must be present");
  return data;
}

before(async () => {
  fixture = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    const url = new URL(request.url ?? "/", "http://localhost");
    const token = request.headers.authorization?.replace("Bearer ", "") ?? "";
    let id = "";
    try { id = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub; } catch { /* unauthenticated */ }
    if (url.pathname === "/auth/v1/user") {
      validatedIdentities++;
      if (providerUnavailable) { response.statusCode = 503; response.end('{"message":"Synthetic outage"}'); return; }
      if (!Object.values(ids).includes(id)) { response.statusCode = 401; response.end('{"message":"Unverified identity"}'); return; }
      response.end(JSON.stringify(user(id))); return;
    }
    if (url.pathname === "/rest/v1/profiles") {
      if (profileUnavailable) { response.statusCode = 500; response.end('{"message":"Synthetic profile outage"}'); return; }
      const active = id === ids.active && !revoked;
      const row = id === ids.missing ? null : { id, full_name: "Synthetic Captain", email: "synthetic-captain@example.com", is_active: active };
      // maybeSingle requests array representation, converted by postgrest-js.
      response.end(JSON.stringify(row ? [row] : [])); return;
    }
    if (url.pathname === "/rest/v1/seasons") {
      response.end(JSON.stringify(id === ids.active && !revoked ? seasons : [])); return;
    }
    if (url.pathname === "/auth/v1/logout") { response.statusCode = 204; response.end(); return; }
    if (url.pathname === "/auth/v1/otp") {
      let body = "";
      request.on("data", chunk => { body += String(chunk); });
      request.on("end", () => {
        otpRequest = { body: JSON.parse(body), redirectTo: url.searchParams.get("redirect_to") };
        response.end('{"user":null,"session":null}');
      });
      return;
    }
    if (url.pathname === "/auth/v1/verify" || url.pathname === "/auth/v1/token") {
      let body = "";
      request.on("data", chunk => { body += String(chunk); });
      request.on("end", () => {
        const input = JSON.parse(body);
        if (input.token_hash === "active-confirm" || (input.auth_code === "active-code" && input.code_verifier === "synthetic-code-verifier")) response.end(JSON.stringify(session("active")));
        else if (input.token_hash === "inactive-confirm") response.end(JSON.stringify(session("inactive")));
        else { response.statusCode = 401; response.end('{"msg":"Invalid synthetic token","code":"otp_expired"}'); }
      });
      return;
    }
    response.statusCode = 400; response.end('{"message":"Unsupported fixture request"}');
  });
  const fixturePort = await listen(fixture);
  const reserve = createServer();
  const appPort = await listen(reserve);
  await close(reserve);
  appOrigin = `http://127.0.0.1:${appPort}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", APP_URL: appOrigin, APP_ENV: "private", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout?.on("data", chunk => { logs += String(chunk); });
  app.stderr?.on("data", chunk => { logs += String(chunk); });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try { if ((await get("/login")).status === 200) return; } catch { /* wait for startup */ }
    if (app.exitCode !== null) throw Error(`Next.js stopped: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Next.js startup timed out: ${logs}`);
});
after(async () => {
  if (app && app.exitCode === null) { const stopped = once(app, "exit"); app.kill("SIGTERM"); await stopped; }
  if (fixture) await close(fixture);
});

test("production login renders a working form with security/cache headers", async () => {
  const response = await get("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Welcome back/);
  assert.match(html, /type="email"/);
  assert.match(html, /Send sign-in link/);
  assert.doesNotMatch(html, /Workspace setup is still in progress/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});
test("anonymous users cannot access any private subtree including file-like paths", async () => {
  for (const path of ["/dashboard", "/prospects", "/settings", "/prospects/player.json", "/settings/members.csv"]) {
    const response = await get(path);
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location")!, appOrigin).pathname, "/login", path);
  }
});
test("active leadership renders the dashboard, prospect placeholder, and own settings", async () => {
  for (const [path, content] of [["/dashboard", "Your recruiting blueprint"], ["/prospects", "A home for every prospect"], ["/settings", "synthetic-captain@example.com"]]) {
    const response = await get(path, "active");
    assert.equal(response.status, 200, `${path}: ${logs}`);
    const html = await response.text();
    assert.match(html, new RegExp(content));
    assert.match(html, /Synthetic Captain/);
    assert.match(html, /2027 Season/);
  }
  assert.ok(validatedIdentities >= 3, "Fresh Auth validation must actually run");
});
test("2026 season URL selects historical context and invalid years fall back to 2027", async () => {
  const historical = await (await get("/dashboard?season=2026", "active")).text();
  assert.match(historical, /Recruiting overview \/ <!-- -->2026/);
  assert.match(historical, /Historical season/);
  const invalid = await (await get("/dashboard?season=not-a-year", "active")).text();
  assert.match(invalid, /Recruiting overview \/ <!-- -->2027/);
});
test("inactive and missing-profile identities are denied despite active user metadata", async () => {
  for (const kind of ["inactive", "missing"] as const) {
    const response = await get("/dashboard", kind);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, appOrigin).searchParams.get("reason"), "access");
  }
});
test("revoked leadership loses access without waiting for token expiry", async () => {
  revoked = true;
  try {
    const response = await get("/settings", "active");
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, appOrigin).searchParams.get("reason"), "access");
  } finally { revoked = false; }
});
test("profile provider failures fail closed", async () => {
  profileUnavailable = true;
  try {
    const response = await get("/dashboard", "active");
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, appOrigin).searchParams.get("reason"), "unavailable");
  } finally { profileUnavailable = false; }
});
test("native sign-in server action normalizes email and never creates an account", async () => {
  const html = await (await get("/login")).text();
  const form = formFromHtml(html, 'name="email"');
  form.set("email", " SYNTHETIC-CAPTAIN@EXAMPLE.COM ");
  const response = await fetch(`${appOrigin}/login`, { method: "POST", body: form, redirect: "manual", headers: { Origin: appOrigin } });
  assert.equal(response.status, 200);
  assert.ok(otpRequest, "Server must actually contact Auth");
  assert.equal(otpRequest.body.email, "synthetic-captain@example.com");
  assert.equal(otpRequest.body.create_user, false);
  assert.equal(otpRequest.redirectTo, `${appOrigin}/auth/callback`);
  assert.match(await response.text(), /If this address has been invited/);
});
test("native sign-out clears the session and redirects to login", async () => {
  const html = await (await get("/dashboard", "active")).text();
  const form = formFromHtml(html, 'aria-label="Sign out"');
  const response = await fetch(`${appOrigin}/dashboard`, { method: "POST", body: form, redirect: "manual", headers: { Cookie: sessionCookie("active"), Origin: appOrigin } });
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")!, appOrigin).pathname, "/login");
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});
test("invalid auth callbacks cannot redirect to untrusted next/host values", async () => {
  for (const path of ["/auth/confirm?type=recovery&token_hash=bad&next=https://evil.example", "/auth/callback?next=https://evil.example"]) {
    const response = await get(path, undefined, { "X-Forwarded-Host": "evil.example" });
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, appOrigin);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("reason"), "link");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});
test("valid token-hash magic/invite links establish a session only for active leadership", async () => {
  for (const type of ["email", "invite"]) {
    const response = await get(`/auth/confirm?type=${type}&token_hash=active-confirm&next=https://evil.example`);
    assert.equal(response.status, 307);
    const target = new URL(response.headers.get("location")!, appOrigin);
    assert.equal(target.origin, appOrigin);
    assert.equal(target.pathname, "/dashboard");
    assert.match(response.headers.get("set-cookie") ?? "", /sb-127-auth-token=/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  const inactive = await get("/auth/confirm?type=email&token_hash=inactive-confirm");
  assert.equal(new URL(inactive.headers.get("location")!, appOrigin).searchParams.get("reason"), "access");
  assert.match(inactive.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});
test("PKCE callback exchanges the code using the verifier cookie", async () => {
  const verifier = `sb-127-auth-token-code-verifier=base64-${Buffer.from(JSON.stringify("synthetic-code-verifier")).toString("base64url")}`;
  const response = await get("/auth/callback?code=active-code&next=https://evil.example", undefined, { Cookie: verifier });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")!, appOrigin).pathname, "/dashboard");
  assert.match(response.headers.get("set-cookie") ?? "", /sb-127-auth-token=/);
});
