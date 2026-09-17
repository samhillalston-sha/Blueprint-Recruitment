import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";

// Isolated synthetic Supabase HTTP fixture, not an application auth bypass.
// Production identity validation and profiles queries run unchanged.
const ids = {
  active: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  inactive: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  missing: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
};
const seasons = [
  { id: "dddddddd-dddd-4ddd-addd-dddddddddddd", name: "2027 Season", year: 2027, is_current: true, status: "active" },
  { id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee", name: "2026 Season", year: 2026, is_current: false, status: "closed" },
];
const syntheticId = "ffffffff-ffff-4fff-afff-ffffffffffff";
const syntheticCandidacyId = "99999999-9999-4999-a999-999999999999";
const ownerId = "88888888-8888-4888-a888-888888888888";
const workflowDefaults = {stage:"Unknown Prospect",priority:null,owner_id:null,next_action:null,follow_up_date:null,projection_year_one:null,projection_year_two:null,projection_year_three:null,version:1,updated_at:"2026-09-17T00:00:00Z"};
function membership(values: Record<string,unknown>) { return {...workflowDefaults,id:syntheticCandidacyId,prospect_id:syntheticId,season_id:seasons[0].id,created_at:"2026-09-17T00:00:00Z",...values}; }
let people = [{ id: syntheticId, full_name: "Synthetic Prospect", normalized_name: "synthetic prospect", email: null, phone: null, social_url: null, location: "Synthetic City", teams: null, age: null, height_cm: null, position: null, created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" }] as Array<Record<string, unknown>>;
let memberships = [membership({})] as Array<Record<string,unknown>>;
let activity = [] as Array<Record<string,unknown>>;
let activityUnavailable = false;
let directoryUnavailable = false;
let workflowWrites = 0;
function recordActivity(personId: unknown, seasonId: unknown, type: string, before: Record<string,unknown>, after: Record<string,unknown>, fields: string[]) {
 const changes=Object.fromEntries(fields.filter(key=>(before[key]??null)!==(after[key]??null)).map(key=>[key,{from:before[key]??null,to:after[key]??null,...(key==="owner_id"?{from_label:before[key]?"Synthetic Owner":null,to_label:after[key]?"Synthetic Owner":null}:{})}]));
 if(type.endsWith("updated") && !Object.keys(changes).length)return;
 activity.unshift({id:String(activity.length+1),prospect_id:personId,season_id:seasonId??null,actor_name:"Synthetic Captain",event_type:type,created_at:new Date().toISOString(),changes});
}
let prospectUnavailable = false;
let prospectWrites = 0;
let fixture: Server;
let app: ChildProcess;
let appOrigin: string;
let profileUnavailable = false;
let revoked = false;
let logs = "";
let validatedIdentities = 0;
let fixtureOrigin: string;
let expectedVerifier = "synthetic-code-verifier";
let exchangedCodes = 0;

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing loopback port");
  return address.port;
}
async function close(server: Server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
function user(id: string) { return { id, email: "synthetic-captain@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { is_active: true }, created_at: "2026-01-01T00:00:00Z" }; }
function session(kind: keyof typeof ids) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: ids[kind], aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`;
  return { access_token: token, refresh_token: "synthetic-refresh", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user: user(ids[kind]) };
}
function sessionCookie(kind: keyof typeof ids): string { return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session(kind))).toString("base64url")}`; }
async function get(path: string, kind?: keyof typeof ids, extraHeaders: Record<string, string> = {}) {
  return fetch(`${appOrigin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { ...(kind ? { Cookie: sessionCookie(kind) } : {}), ...extraHeaders } });
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
      const selected = url.searchParams.get("id")?.replace(/^eq\./,"");
      response.end(JSON.stringify(id === ids.active && !revoked ? seasons.filter(item => !selected || item.id === selected) : [])); return;
    }
    if (url.pathname === "/rest/v1/prospects") {
      if (prospectUnavailable) { response.statusCode=500; response.end('{"message":"Synthetic prospect outage"}'); return; }
      let rows = id === ids.active && !revoked ? [...people] : [];
      for (const key of ["id","normalized_name"]) {
        const filter = url.searchParams.get(key);
        if (filter?.startsWith("eq.")) rows = rows.filter(row => row[key] === filter.slice(3));
        if (filter?.startsWith("neq.")) rows = rows.filter(row => row[key] !== filter.slice(4));
      }
      const seasonFilter = url.searchParams.get("candidacies.season_id");
      if (seasonFilter && url.searchParams.get("select")?.includes("!inner")) rows = rows.filter(row => memberships.some(m => m.prospect_id === row.id && m.season_id === seasonFilter.slice(3)));
      const search = url.searchParams.get("full_name");
      if (search?.startsWith("ilike.")) rows = rows.filter(row => String(row.full_name).toLowerCase().includes(search.slice(7,-1).toLowerCase()));
      if (request.method === "PATCH") {
        let body=""; request.on("data",chunk=>{body+=String(chunk);}); request.on("end",()=>{
          const values=JSON.parse(body); prospectWrites++;
          rows.forEach(row=>{recordActivity(row.id,null,"prospect_updated",row,values,Object.keys(values));Object.assign(row,values,{normalized_name:String(values.full_name).trim().replace(/\s+/g," ").toLowerCase()});});
          response.end(JSON.stringify(rows.map(row=>({id:row.id}))));
        }); return;
      }
      response.setHeader("Content-Range", "0-" + Math.max(0,rows.length-1) + "/" + rows.length);
      response.end(JSON.stringify(rows.map(row=>({...row,candidacies:memberships.filter(m=>m.prospect_id===row.id&&(!seasonFilter||m.season_id===seasonFilter.slice(3)))})))); return;
    }
    if (url.pathname === "/rest/v1/candidacies") {
      if (request.method === "POST") {
        let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
          const values=JSON.parse(body);prospectWrites++;
          memberships.push(membership({...values,id:"77777777-7777-4777-a777-777777777777"}));recordActivity(values.prospect_id,values.season_id,"season_added",{},workflowDefaults,["stage"]);response.statusCode=201;response.end("");
        });return;
      }
      let rows=id===ids.active&&!revoked?[...memberships]:[];
      for(const key of ["id","prospect_id","season_id","stage","version"]) {const filter=url.searchParams.get(key);if(filter?.startsWith("eq."))rows=rows.filter(row=>String(row[key])===filter.slice(3));}
      if(request.method==="PATCH") {
       let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
        const values=JSON.parse(body);workflowWrites++;
        rows.forEach(row=>{const changed=Object.keys(values).some(key=>row[key]!==values[key]);recordActivity(row.prospect_id,row.season_id,"workflow_updated",row,values,Object.keys(values));Object.assign(row,values,{version:Number(row.version)+(changed?1:0)});});
        response.end(JSON.stringify(rows.map(row=>({id:row.id}))));
       });return;
      }
      response.setHeader("Content-Range","0-"+Math.max(0,rows.length-1)+"/"+rows.length);
      response.end(request.method==="HEAD"?undefined:JSON.stringify(rows));return;
    }
    if(url.pathname==="/rest/v1/rpc/recruiting_leaders") {
     if(directoryUnavailable){response.statusCode=500;response.end('{"message":"Synthetic directory outage"}');return;}
     response.end(JSON.stringify([{id:ids.active,full_name:"Synthetic Captain",is_active:true},{id:ownerId,full_name:"Synthetic Owner",is_active:true}]));return;
    }
    if(url.pathname==="/rest/v1/prospect_activity") {
     if(activityUnavailable){response.statusCode=500;response.end('{"message":"Synthetic activity outage"}');return;}
     const rows=activity.filter(row=>row.prospect_id===url.searchParams.get("prospect_id")?.slice(3));
     response.setHeader("Content-Range","0-"+Math.max(0,rows.length-1)+"/"+rows.length);
     const offset=Number(url.searchParams.get("offset")??0);response.end(JSON.stringify(rows.slice(offset,offset+25)));return;
    }
    if (url.pathname === "/rest/v1/rpc/create_prospect") {
      let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
        const values=JSON.parse(body);prospectWrites++;
        const personId="11111111-1111-4111-a111-111111111111";
        people.push({...values.p_facts,id:personId,normalized_name:values.p_facts.full_name.trim().replace(/\s+/g," ").toLowerCase(),created_at:"2026-09-17T00:00:00Z",updated_at:"2026-09-17T00:00:00Z"});
        memberships.push(membership({id:"66666666-6666-4666-a666-666666666666",prospect_id:personId,season_id:values.p_season_id}));
        recordActivity(personId,null,"prospect_created",{},values.p_facts,Object.keys(values.p_facts));
        recordActivity(personId,values.p_season_id,"season_added",{},workflowDefaults,["stage"]);
        response.end(JSON.stringify(personId));
      });return;
    }
    if (url.pathname === "/auth/v1/logout") { response.statusCode = 204; response.end(); return; }
    if (url.pathname === "/auth/v1/token") {
      let body = "";
      request.on("data", chunk => { body += String(chunk); });
      request.on("end", () => {
        const input = JSON.parse(body);
        exchangedCodes++;
        if (input.auth_code === "active-code" && input.code_verifier === expectedVerifier) response.end(JSON.stringify(session("active")));
        else if (input.auth_code === "inactive-code" && input.code_verifier === expectedVerifier) response.end(JSON.stringify(session("inactive")));
        else { response.statusCode = 401; response.end('{"msg":"Invalid synthetic code","code":"bad_code_verifier"}'); }
      });
      return;
    }
    response.statusCode = 400; response.end('{"message":"Unsupported fixture request"}');
  });
  const fixturePort = await listen(fixture);
  fixtureOrigin = `http://127.0.0.1:${fixturePort}`;
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
  if (app && app.exitCode === null) {
    const stopped = once(app, "exit");
    app.kill("SIGTERM");
    const timer = setTimeout(() => app.kill("SIGKILL"), 5000);
    try { await stopped; } finally { clearTimeout(timer); }
  }
  if (fixture) await close(fixture);
});

test("production login renders a working form with security/cache headers", async () => {
  const response = await get("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Welcome back/);
  assert.match(html, /Sign in with Google/);
  assert.match(html, /Use your individual Google account/);
  assert.doesNotMatch(html, /type="email"|Send sign-in link/);
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
test("active leadership renders the dashboard, prospect list, and own settings", async () => {
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
test("native Google sign-in creates a PKCE verifier and redirects only to the configured provider", async () => {
  const html = await (await get("/login")).text();
  const form = formFromHtml(html, "Sign in with Google");
  form.set("next", "https://evil.example"); // Caller-supplied destinations are ignored.
  const response = await fetch(`${appOrigin}/login`, { method: "POST", body: form, redirect: "manual", headers: { Origin: appOrigin } });
  assert.equal(response.status, 303);
  const target = new URL(response.headers.get("location")!, appOrigin);
  assert.equal(target.origin, fixtureOrigin);
  assert.equal(target.pathname, "/auth/v1/authorize");
  assert.equal(target.searchParams.get("provider"), "google");
  assert.equal(target.searchParams.get("redirect_to"), `${appOrigin}/auth/callback`);
  assert.equal(target.searchParams.get("prompt"), "select_account");
  assert.equal(target.searchParams.get("scopes"), "openid email profile");
  assert.equal(target.searchParams.get("code_challenge_method"), "s256");
  assert.ok(target.searchParams.get("code_challenge"));
  const cookies = response.headers.getSetCookie();
  const verifierCookie = cookies.find(cookie => cookie.startsWith("sb-127-auth-token-code-verifier="));
  assert.ok(verifierCookie, "Provider start must persist the verifier in the browser");
  const encoded = verifierCookie.split(";")[0].split("=")[1].replace(/^base64-/, "");
  expectedVerifier = JSON.parse(Buffer.from(encoded, "base64url").toString());
  try {
    const callback = await get("/auth/callback?code=active-code", undefined, { Cookie: cookies.map(cookie => cookie.split(";")[0]).join("; ") });
    assert.equal(new URL(callback.headers.get("location")!, appOrigin).pathname, "/dashboard");
    assert.match(callback.headers.get("set-cookie") ?? "", /sb-127-auth-token=/);
  } finally { expectedVerifier = "synthetic-code-verifier"; }
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
  for (const path of ["/auth/callback?next=https://evil.example", "/auth/callback?error=access_denied&error_description=Untrusted", "/auth/callback?code=bad-code"]) {
    const response = await get(path, undefined, { "X-Forwarded-Host": "evil.example" });
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location")!, appOrigin);
    assert.equal(location.origin, appOrigin);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("reason"), "oauth");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});
test("a successful Google callback does not grant access to inactive leadership", async () => {
  const verifier = `sb-127-auth-token-code-verifier=base64-${Buffer.from(JSON.stringify("synthetic-code-verifier")).toString("base64url")}`;
  const inactive = await get("/auth/callback?code=inactive-code", undefined, { Cookie: verifier });
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
test("provider errors cannot be paired with a code to establish a session", async () => {
  const previous = exchangedCodes;
  const response = await get("/auth/callback?code=active-code&error=access_denied");
  assert.equal(new URL(response.headers.get("location")!, appOrigin).searchParams.get("reason"), "oauth");
  assert.equal(exchangedCodes, previous);
});
test("legacy emailed-token confirmation is not an available sign-in route", async () => {
  assert.equal((await get("/auth/confirm?token_hash=active-confirm&type=email")).status, 404);
});

async function submitProspect(path: string, values: Record<string,string>, kind: keyof typeof ids = "active") {
 const html = await (await get(path,"active")).text();
 const form = formFromHtml(html,'name="full_name"');
 Object.entries(values).forEach(([key,value])=>form.set(key,value));
 try { return await fetch(appOrigin+path,{method:"POST",body:form,redirect:"manual",signal:AbortSignal.timeout(15000),headers:{Cookie:sessionCookie(kind),Origin:appOrigin}}); } catch (error) { throw new Error("Action POST stalled: " + path + "\n" + logs.slice(-6000), {cause:error}); }
}
test("prospect list, facts, profile and season history render; invalid profiles are 404",async()=>{
 const list = await (await get("/prospects","active")).text();
 assert.match(list,/Synthetic Prospect/);
 const profile = await (await get("/prospects/"+syntheticId,"active")).text();
 assert.match(profile,/Synthetic City/);
 assert.match(profile,/Season history/);
 assert.match(profile,/2027 Season/);
 assert.equal((await get("/prospects/not-a-uuid","active")).status,404);
 assert.equal((await get("/prospects/22222222-2222-4222-a222-222222222222","active")).status,404);
 const empty = await (await get("/prospects?season=2026","active")).text();
 assert.match(empty,/No prospects in this season yet/);
 const all = await (await get("/prospects?season=2026&view=all","active")).text();
 assert.match(all,/Synthetic Prospect/);
 assert.match(await (await get("/prospects?view=all&q=NoMatch","active")).text(),/No prospects match/);
});
test("create action warns on duplicate names without writing",async()=>{
 const before=prospectWrites;
 const response=await submitProspect("/prospects/new",{full_name:"  SYNTHETIC  Prospect "});
 assert.equal(response.status,200);
 assert.match(await response.text(),/This name already exists/);
 assert.equal(prospectWrites,before);
});
test("native create and edit actions persist synthetic facts and redirect to profile",async()=>{
 const create=await submitProspect("/prospects/new",{full_name:"Synthetic New Player",position:"Cutter",location:"Synthetic Borough"});
 assert.equal(create.status,303);
 const path=new URL(create.headers.get("location")!,appOrigin).pathname;
 assert.match(await (await get(path,"active")).text(),/Synthetic Borough/);
 const edit=await submitProspect(path+"/edit",{full_name:"Synthetic Renamed Player",position:"Handler"});
 assert.equal(edit.status,303);
 assert.match(await (await get(path,"active")).text(),/Synthetic Renamed Player/);
});
test("validation and closed seasons prevent writes; inactive identity cannot post a captured action",async()=>{
 const before=prospectWrites;
 const invalid=await submitProspect("/prospects/new",{full_name:"Synthetic Invalid",position:"Hybrid"});
 assert.equal(invalid.status,200);
 assert.equal(prospectWrites,before);
 const historical=await (await get("/prospects/new?season=2026","active")).text();
 assert.match(historical,/Historical seasons are read-only/);
 assert.doesNotMatch(historical,/name="full_name"/);
 const inactive=await submitProspect("/prospects/new",{full_name:"Synthetic Forbidden"},"inactive");
 assert.ok([303,307].includes(inactive.status));
 assert.equal(new URL(inactive.headers.get("location")!,appOrigin).pathname,"/login");
 assert.equal(prospectWrites,before);
});
test("prospect provider failure produces an error rather than an empty database",async()=>{
 prospectUnavailable=true;
 try { const response=await get("/prospects","active"); const html=await response.text(); assert.doesNotMatch(html,/No prospect records yet/); assert.match(html,/Something|try again|error|unavailable/i); }
 finally { prospectUnavailable=false; }
});

test("same-name override and edit duplicate checks require explicit confirmation",async()=>{
 const originalPeople=[...people];const originalMemberships=[...memberships];
 try {
  const before=prospectWrites;
  const response=await submitProspect("/prospects/new",{full_name:"Synthetic Prospect",confirm_duplicate:"synthetic prospect"});
  assert.equal(response.status,303);
  assert.equal(prospectWrites,before+1);
  const edit=await submitProspect("/prospects/"+syntheticId+"/edit",{full_name:"Synthetic Renamed Player"});
  assert.equal(edit.status,200);
  assert.match(await edit.text(),/This name already exists/);
  assert.equal(prospectWrites,before+1);
 } finally {people=originalPeople;memberships=originalMemberships;}
});
test("existing profile is reused in another season without creating a person",async()=>{
 const beforeMemberships=[...memberships];
 const beforePeople=people.length;
 memberships=memberships.filter(row=>row.prospect_id!==syntheticId);
 memberships.push(membership({season_id:seasons[1].id}));
 try {
  const path="/prospects/"+syntheticId+"?season=2027";
  const html=await (await get(path,"active")).text();
  const form=formFromHtml(html,"Add to this season");
  const response=await fetch(appOrigin+path,{method:"POST",body:form,redirect:"manual",headers:{Cookie:sessionCookie("active"),Origin:appOrigin}});
  assert.equal(response.status,303);
  assert.equal(people.length,beforePeople);
  const profile=await (await get(path,"active")).text();
  assert.match(profile,/Included in/);
  assert.equal(memberships.filter(row=>row.prospect_id===syntheticId).length,2);
 } finally {memberships=beforeMemberships;}
});

const blankWorkflow={stage:"Unknown Prospect",priority:"",owner_id:"",next_action:"",follow_up_date:"",projection_year_one:"",projection_year_two:"",projection_year_three:""};
async function workflowForm() {return formFromHtml(await (await get("/prospects/"+syntheticId+"?season=2027","active")).text(),'name="stage"');}
async function postWorkflow(form:FormData,values:Record<string,string>,kind:keyof typeof ids="active") {
 Object.entries({...blankWorkflow,...values}).forEach(([key,value])=>form.set(key,value));
 return fetch(appOrigin+"/prospects/"+syntheticId+"?season=2027",{method:"POST",body:form,redirect:"manual",signal:AbortSignal.timeout(15000),headers:{Cookie:sessionCookie(kind),Origin:appOrigin}});
}
test("workflow save persists all seasonal fields, updates pipeline/list and renders attributed before/after activity",async()=>{
 const response=await postWorkflow(await workflowForm(),{stage:"Known Prospect",priority:"High",owner_id:ownerId,next_action:"Synthetic outreach",follow_up_date:"2027-01-15",projection_year_one:"Synthetic first year",projection_year_two:"Synthetic second year",projection_year_three:"Synthetic third year"});
 assert.equal(response.status,303);
 const row=memberships.find(row=>row.prospect_id===syntheticId&&row.season_id===seasons[0].id)!;
 assert.equal(row.version,2);assert.equal(row.owner_id,ownerId);assert.equal(row.projection_year_three,"Synthetic third year");
 const html=await(await get("/prospects/"+syntheticId,"active")).text();
 for(const text of ["Synthetic outreach","Synthetic first year","Synthetic second year","Synthetic third year","Activity timeline","Synthetic Captain","Recruiting workflow updated","Unknown Prospect","Known Prospect","Synthetic Owner"])assert.ok(html.includes(text),text);
 assert.match(html,/2027.*Year 1/);assert.match(html,/2029.*Year 3/);
 const list=await(await get("/prospects","active")).text();assert.match(list,/Synthetic outreach/);assert.match(list,/Synthetic Owner/);
 const dashboard=await(await get("/dashboard","active")).text();assert.match(dashboard,/aria-label="Known Prospect count">1</);
 const before=activity.length;const version=row.version;
 const noop=await postWorkflow(await workflowForm(),{stage:"Known Prospect",priority:"High",owner_id:ownerId,next_action:"Synthetic outreach",follow_up_date:"2027-01-15",projection_year_one:"Synthetic first year",projection_year_two:"Synthetic second year",projection_year_three:"Synthetic third year"});
 assert.equal(noop.status,303);assert.equal(activity.length,before);assert.equal(row.version,version);
});
test("historical workflow stays independent and has no edit form",async()=>{
 const original=[...memberships];memberships.push(membership({id:"55555555-5555-4555-a555-555555555555",season_id:seasons[1].id,stage:"Confirmed for Tryouts",priority:"Low",projection_year_one:"Synthetic historical outlook"}));
 try{
  const html=await(await get("/prospects/"+syntheticId+"?season=2026","active")).text();
  assert.match(html,/Historical.*Read-only/);assert.match(html,/Synthetic historical outlook/);assert.match(html,/Confirmed for Tryouts/);
  assert.doesNotMatch(html,/name="stage"|Save recruiting details/);
  const panel=html.match(/<section class="panel"><div class="section-heading"><h2>Recruiting workflow[\s\S]*?<\/section>/)?.[0];
  assert.ok(panel);assert.doesNotMatch(panel,/Synthetic first year/);
  assert.equal(memberships.find(row=>row.season_id===seasons[0].id&&row.prospect_id===syntheticId)?.stage,"Known Prospect");
 }finally{memberships=original;}
});
test("stale workflow actions preserve another leader's edit",async()=>{
 const form=await workflowForm();const row=memberships.find(row=>row.prospect_id===syntheticId&&row.season_id===seasons[0].id)!;
 row.version=Number(row.version)+1;row.next_action="Synthetic concurrent edit";const before=workflowWrites;
 const response=await postWorkflow(form,{next_action:"Would overwrite"});assert.equal(response.status,200);
 assert.match(await response.text(),/Another leader updated this record/);assert.equal(workflowWrites,before);assert.equal(row.next_action,"Synthetic concurrent edit");
});
test("invalid workflow dates and non-approved owners cannot write",async()=>{
 const before=workflowWrites;
 for(const values of [{follow_up_date:"2026-02-30"},{owner_id:ids.inactive},{stage:"Rostered"}] as Record<string,string>[]) {
  const response=await postWorkflow(await workflowForm(),values);assert.equal(response.status,200);assert.match(await response.text(),/role="alert"/);
 }
 assert.equal(workflowWrites,before);
});
test("captured workflow action is denied after leadership revocation or season closure",async()=>{
 const form=await workflowForm();const before=workflowWrites;
 const inactive=await postWorkflow(form,{next_action:"Forbidden"},"inactive");assert.equal(new URL(inactive.headers.get("location")!,appOrigin).pathname,"/login");
 revoked=true;
 try{const denied=await postWorkflow(form,{next_action:"Forbidden"});assert.equal(new URL(denied.headers.get("location")!,appOrigin).pathname,"/login");}finally{revoked=false;}
 seasons[0].status="closed";
 try{const closed=await postWorkflow(form,{next_action:"Forbidden"});assert.equal(closed.status,200);assert.match(await closed.text(),/Historical seasons are read-only/);}finally{seasons[0].status="active";}
 assert.equal(workflowWrites,before);
});
test("directory and timeline failures show errors instead of invented empty data",async()=>{
 for(const source of ["directory","activity"]) {
  directoryUnavailable=source==="directory";activityUnavailable=source==="activity";
  try{const html=await(await get("/prospects/"+syntheticId,"active")).text();assert.doesNotMatch(html,/No recorded activity yet/);assert.match(html,/Something|try again|error|unavailable/i);}
  finally{directoryUnavailable=false;activityUnavailable=false;}
 }
});
test("activity pagination preserves season context and distinguishes an out-of-range page from no history",async()=>{
 const original=[...activity];
 for(let i=0;i<30;i++)recordActivity(syntheticId,seasons[0].id,"workflow_updated",{next_action:"Synthetic previous "+i},{next_action:"Synthetic next "+i},["next_action"]);
 try{
  const first=await(await get("/prospects/"+syntheticId+"?season=2027","active")).text();assert.match(first,/activityPage=2/);
  const second=await(await get("/prospects/"+syntheticId+"?season=2027&activityPage=2","active")).text();assert.match(second,/Page <!-- -->2/);assert.match(second,/season=2027&amp;activityPage=1/);assert.match(second,/Synthetic Captain/);
  const empty=await(await get("/prospects/"+syntheticId+"?season=2027&activityPage=100","active")).text();assert.match(empty,/No activity on this page/);assert.doesNotMatch(empty,/No recorded activity yet/);
 }finally{activity=original;}
});

// Hosted CI runs this when local sandbox socket restrictions prevent Chrome.
// Same isolated provider; no real Google login, credentials, or app auth bypass.
test("hydrated browser saves workflow, displays attributed activity and preserves historical/mobile views",{skip:process.env.BLUEPRINT_BROWSER_QA!=="1",timeout:120_000},async()=>{
 const run=promisify(execFile);
 const browser=async(...args:string[])=>{
  const result=await run("npx",["--yes","agent-browser@0.38.1",...args],{env:{...process.env,AGENT_BROWSER_SESSION:"blueprint-phase3-ci"},timeout:40_000,maxBuffer:2_000_000});
  return result.stdout;
 };
 const original=memberships.map(row=>({...row}));
 memberships.push(membership({id:"55555555-5555-4555-a555-555555555555",season_id:seasons[1].id,stage:"Confirmed for Tryouts",projection_year_one:"Synthetic historical browser outlook"}));
 await mkdir(".qa",{recursive:true});
 try{
  await browser("open",appOrigin+"/login");
  const cookie=sessionCookie("active");const separator=cookie.indexOf("=");
  await browser("cookies","set",cookie.slice(0,separator),cookie.slice(separator+1),"--url",appOrigin);
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2027");
  await browser("wait",'select[name="stage"]');
  const initial=await browser("snapshot","-i");assert.match(initial,/Save recruiting details/);
  await browser("batch","--bail",
   'select select[name="stage"] "Confirmed for Tryouts"',
   'select select[name="priority"] High',
   'select select[name="owner_id"] '+ownerId,
   'fill textarea[name="next_action"] "Synthetic browser follow-up"',
   'fill input[name="follow_up_date"] 2027-02-01',
   'fill textarea[name="projection_year_one"] "Synthetic browser year one"',
   'fill textarea[name="projection_year_two"] "Synthetic browser year two"',
   'fill textarea[name="projection_year_three"] "Synthetic browser year three"',
   'find role button click --name "Save recruiting details"');
  await browser("wait","--text","Synthetic browser year three");
  const saved=await browser("snapshot");
  for(const text of ["Synthetic browser follow-up","Synthetic browser year one","Synthetic browser year two","Synthetic browser year three","Recruiting workflow updated","Synthetic Captain","Synthetic Owner"])assert.ok(saved.includes(text),text);
  assert.equal(memberships.find(row=>row.prospect_id===syntheticId&&row.season_id===seasons[0].id)?.stage,"Confirmed for Tryouts");
  await browser("screenshot",".qa/phase3-profile-desktop.png","--full");
  await browser("open",appOrigin+"/prospects?season=2027");
  assert.match(await browser("snapshot"),/Synthetic browser follow-up/);
  await browser("open",appOrigin+"/dashboard?season=2027");
  assert.match(await browser("get","text",'[aria-label="Confirmed for Tryouts count"]'),/1/);
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2026");
  assert.match(await browser("snapshot"),/Synthetic historical browser outlook/);
  assert.doesNotMatch(await browser("snapshot","-i"),/Save recruiting details/);
  await browser("set","viewport","390","844");
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2027");
  await browser("screenshot",".qa/phase3-profile-mobile.png","--full");
  const layout=JSON.parse(await browser("eval","({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})","--json"));
  const dimensions=layout.data.result;assert.ok(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));
  const report=JSON.parse(await browser("errors","--json"));assert.deepEqual(report.data.errors,[]);
  const consoleLog=await browser("console");assert.doesNotMatch(consoleLog,/hydration|Minified React|Uncaught/i,consoleLog);
 }finally{
  memberships=original;await browser("close");
 }
});
