import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

// Isolated synthetic Supabase HTTP fixture, not an application auth bypass.
// Production identity validation and profiles queries run unchanged.
const ids = {
  active: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  inactive: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  missing: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
};
const seasons: Array<{id:string;name:string;year:number;is_current:boolean;status:string;closed_at?:string|null;closed_by_name?:string|null}> = [
  { id: "dddddddd-dddd-4ddd-addd-dddddddddddd", name: "2027 Season", year: 2027, is_current: true, status: "active" },
  { id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee", name: "2026 Season", year: 2026, is_current: false, status: "closed" },
];
const syntheticId = "ffffffff-ffff-4fff-afff-ffffffffffff";
const syntheticCandidacyId = "99999999-9999-4999-a999-999999999999";
const ownerId = "88888888-8888-4888-a888-888888888888";
const workflowDefaults = {outcome:null,stage:"Unknown Prospect",priority:null,owner_id:null,next_action:null,follow_up_date:null,projection_year_one:null,projection_year_two:null,projection_year_three:null,version:1,updated_at:"2026-09-17T00:00:00Z"};
function membership(values: Record<string,unknown>) { return {...workflowDefaults,id:syntheticCandidacyId,prospect_id:syntheticId,season_id:seasons[0].id,created_at:"2026-09-17T00:00:00Z",...values}; }
let people = [{ id: syntheticId, full_name: "Synthetic Prospect", normalized_name: "synthetic prospect", email: null, phone: null, social_url: null, location: "Synthetic City", teams: null, age: null, height_cm: null, position: null, created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" }] as Array<Record<string, unknown>>;
let memberships = [membership({})] as Array<Record<string,unknown>>;
let activity = [] as Array<Record<string,unknown>>;
let activityUnavailable = false;
let directoryUnavailable = false;
let dashboardUnavailable = false;
let workflowWrites = 0;
const ratingKeys=["athleticism","offensive_ability","defensive_ability","coachability","on_field_vibes","off_field_vibes"];
let evaluations:Array<Record<string,unknown>>=[];
let evaluationsUnavailable=false;
let evaluationWrites=0;
function recordActivity(personId: unknown, seasonId: unknown, type: string, before: Record<string,unknown>, after: Record<string,unknown>, fields: string[]) {
 const changes=Object.fromEntries(fields.filter(key=>type==="evaluation_submitted"||(before[key]??null)!==(after[key]??null)).map(key=>[key,{from:before[key]??null,to:after[key]??null,...(key==="owner_id"?{from_label:before[key]?"Synthetic Owner":null,to_label:after[key]?"Synthetic Owner":null}:{})}]));
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
    if (url.pathname === "/rest/v1/rpc/start_season" || url.pathname === "/rest/v1/rpc/close_season") {
      let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
       const args=JSON.parse(body);
       if(id!==ids.active||revoked){response.statusCode=403;response.end('{"message":"Approval required"}');return;}
       if(url.pathname.endsWith("start_season")) {
        if(!Number.isInteger(args.p_year)||args.p_year>2100||seasons.some(s=>s.year>=args.p_year)){response.statusCode=400;response.end('{"message":"Year unavailable"}');return;}
        seasons.forEach(s=>{s.is_current=false;});const row={id:"22222222-2222-4222-a222-222222222222",year:args.p_year,name:args.p_year+" Season",status:"active",is_current:true};seasons.unshift(row);response.end(JSON.stringify(row.id));
       }else{
        const row=seasons.find(s=>s.id===args.p_season_id);
        if(!row||row.year!==args.p_confirm_year){response.statusCode=400;response.end('{"message":"Year confirmation mismatch"}');return;}
        if(row.status!=="closed")Object.assign(row,{status:"closed",is_current:false,closed_at:new Date().toISOString(),closed_by_name:"Synthetic Captain"});response.end(JSON.stringify(row.id));
       }
      });return;
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
          const values=JSON.parse(body);
          if(memberships.some(row=>row.prospect_id===values.prospect_id&&row.season_id===values.season_id)){response.statusCode=409;response.end('{"code":"23505"}');return;}
          if(!seasons.some(row=>row.id===values.season_id&&row.status==="active")){response.statusCode=403;response.end('{"message":"Closed"}');return;}
          prospectWrites++;
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
    if(url.pathname==="/rest/v1/rpc/recruiting_dashboard") {
     if(dashboardUnavailable){response.statusCode=500;response.end('{"message":"Synthetic dashboard outage"}');return;}
     let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
      const args=JSON.parse(body);const today=new Date().toISOString().slice(0,10);
      const rows:Array<Record<string,unknown>>=memberships.filter(row=>row.season_id===args.p_season_id).map(row=>({...row,full_name:people.find(p=>p.id===row.prospect_id)?.full_name}));
      const paged=(items:Array<Record<string,unknown>>,key:string)=>{const page=Math.max(1,Math.min(Math.ceil(items.length/10)||1,Number(args.p_pages?.[key])||1));return{count:items.length,page,rows:items.slice((page-1)*10,page*10)};};
      const ordered=[...rows].sort((a,b)=>String(a.follow_up_date??"9999").localeCompare(String(b.follow_up_date??"9999"))||String(a.full_name).localeCompare(String(b.full_name))||String(a.id).localeCompare(String(b.id)));
      const events:Array<Record<string,unknown>>=activity.filter(event=>rows.some(row=>row.prospect_id===event.prospect_id)&&(event.season_id===args.p_season_id||event.season_id===null)).map((event):Record<string,unknown>=>({...event,full_name:people.find(p=>p.id===event.prospect_id)?.full_name})).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));
      response.end(JSON.stringify({today,stages:["Unknown Prospect","Known Prospect","Confirmed for Tryouts"].map(stage=>rows.filter(row=>row.stage===stage).length),queues:{
       overdue:paged(ordered.filter(row=>row.follow_up_date&&String(row.follow_up_date)<today),"overdue"),
       upcoming:paged(ordered.filter(row=>row.follow_up_date&&String(row.follow_up_date)>=today),"upcoming"),
       owners:paged(ordered.filter(row=>row.owner_id===null),"owners"),
       actions:paged(ordered.filter(row=>!String(row.next_action??"").trim()),"actions")},activity:paged(events,"activity")}));
     });return;
    }
    if(url.pathname==="/rest/v1/rpc/evaluation_summary") {
     if(evaluationsUnavailable){response.statusCode=500;response.end('{"message":"Synthetic evaluations outage"}');return;}
     let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
      const args=JSON.parse(body);const rows=evaluations.filter(row=>row.candidacy_id===args.p_candidacy_id).sort((a,b)=>String(a.evaluator_name).localeCompare(String(b.evaluator_name))||String(a.evaluator_id).localeCompare(String(b.evaluator_id)));
      const averages=Object.fromEntries(ratingKeys.map(key=>{const rated=rows.filter(row=>row[key]!==null);return[key,{mean:rated.length?rated.reduce((sum,row)=>sum+Number(row[key]),0)/rated.length:null,count:rated.length,na:rows.length-rated.length}];}));
      const page=Math.max(1,Math.min(Math.ceil(rows.length/25)||1,args.p_page||1));
      response.end(JSON.stringify({count:rows.length,page,rows:rows.slice((page-1)*25,page*25),own:rows.find(row=>row.evaluator_id===id)??null,averages}));
     });return;
    }
    if(url.pathname==="/rest/v1/evaluations") {
     if(evaluationsUnavailable){response.statusCode=500;response.end('{"message":"Synthetic evaluations outage"}');return;}
     let rows=evaluations.filter(row=>row.evaluator_id===id);
     for(const key of ["candidacy_id","evaluator_id","version"]) {const filter=url.searchParams.get(key);if(filter?.startsWith("eq."))rows=rows.filter(row=>String(row[key])===filter.slice(3));}
     let body="";request.on("data",chunk=>{body+=String(chunk);});request.on("end",()=>{
      const values=JSON.parse(body);const now=new Date().toISOString();
      if(request.method==="POST") {
       if(evaluations.some(row=>row.candidacy_id===values.candidacy_id&&row.evaluator_id===id)){response.statusCode=409;response.end('{"code":"23505","message":"Synthetic duplicate evaluation"}');return;}
       const row={...values,id:"77777777-7777-4777-a777-777777777777",evaluator_id:id,evaluator_name:"Synthetic Captain",version:1,created_at:now,updated_at:now};evaluations.push(row);rows=[row];
       const candidacy=memberships.find(c=>c.id===values.candidacy_id)!;recordActivity(candidacy.prospect_id,candidacy.season_id,"evaluation_submitted",{},row,ratingKeys);
      } else if(request.method==="PATCH") {
       rows.forEach(row=>{const previous={...row};if(ratingKeys.some(key=>row[key]!==values[key])){Object.assign(row,values,{version:Number(row.version)+1,updated_at:now});const candidacy=memberships.find(c=>c.id===row.candidacy_id)!;recordActivity(candidacy.prospect_id,candidacy.season_id,"evaluation_updated",previous,row,ratingKeys);}});
      }
      evaluationWrites++;response.end(JSON.stringify(rows.map(row=>({id:row.id}))));
     });return;
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
   'fill textarea[name="projection_year_one"] "Synthetic browser year one"',
   'fill textarea[name="projection_year_two"] "Synthetic browser year two"',
   'fill textarea[name="projection_year_three"] "Synthetic browser year three"');
  // Native calendar inputs use an ISO value; text typing can clear the date.
  await browser("eval",`(()=>{const input=document.querySelector('input[name="follow_up_date"]');input.value='2027-02-01';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.match(await browser("get","value",'input[name="follow_up_date"]'),/2027-02-01/);
  await browser("find","role","button","click","--name","Save recruiting details");
  await browser("wait","--text","Synthetic browser year three");
  const saved=await browser("snapshot");
  for(const text of ["Synthetic browser follow-up","Synthetic browser year one","Synthetic browser year two","Synthetic browser year three","Recruiting workflow updated","Synthetic Captain","Synthetic Owner"])assert.ok(saved.includes(text),text);
  const savedRecord=memberships.find(row=>row.prospect_id===syntheticId&&row.season_id===seasons[0].id)!;
  const expected={stage:"Confirmed for Tryouts",priority:"High",owner_id:ownerId,next_action:"Synthetic browser follow-up",follow_up_date:"2027-02-01",projection_year_one:"Synthetic browser year one",projection_year_two:"Synthetic browser year two",projection_year_three:"Synthetic browser year three"};
  for(const [field,value] of Object.entries(expected))assert.equal(savedRecord[field],value,field);
  assert.match(await browser("get","value",'input[name="follow_up_date"]'),/2027-02-01/);
  const desktop=resolve(".qa/phase3-profile-desktop.png");
  await browser("screenshot",desktop,"--full");assert.ok((await stat(desktop)).size>0);
  await browser("open",appOrigin+"/prospects?season=2027");
  assert.match(await browser("snapshot"),/Synthetic browser follow-up/);
  await browser("open",appOrigin+"/dashboard?season=2027");
  assert.match(await browser("get","text",'[aria-label="Confirmed for Tryouts count"]'),/1/);
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2026");
  assert.match(await browser("snapshot"),/Synthetic historical browser outlook/);
  assert.doesNotMatch(await browser("snapshot","-i"),/Save recruiting details/);
  await browser("set","viewport","390","844");
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2027");
  const mobile=resolve(".qa/phase3-profile-mobile.png");
  await browser("screenshot",mobile,"--full");assert.ok((await stat(mobile)).size>0);
  const layout=JSON.parse(await browser("eval","({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})","--json"));
  const dimensions=layout.data.result;assert.ok(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));
  const report=JSON.parse(await browser("errors","--json"));assert.deepEqual(report.data.errors,[]);
  const consoleLog=await browser("console");assert.doesNotMatch(consoleLog,/hydration|Minified React|Uncaught/i,consoleLog);
 }finally{
  memberships=original;await browser("close");
 }
});

function seedDashboard() {
 const original={people,memberships,activity};
 const today=new Date().toISOString().slice(0,10);
 const yesterday=new Date(Date.parse(today)+-86400000).toISOString().slice(0,10);
 const tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
 people=[];memberships=[];activity=[];
 for(let i=0;i<17;i++) {
  const id=`40000000-0000-4000-a000-${String(i).padStart(12,"0")}`;
  people.push({...original.people[0],id,full_name:`Synthetic Dashboard ${String(i).padStart(2,"0")}`});
  memberships.push(membership({id:`50000000-0000-4000-a000-${String(i).padStart(12,"0")}`,prospect_id:id,season_id:seasons[i===16?1:0].id,stage:["Unknown Prospect","Known Prospect","Confirmed for Tryouts"][i%3],owner_id:i<2?null:ownerId,next_action:i===0?null:i===1?"":i===2?" \t\n ":"Synthetic follow-up "+i,follow_up_date:i<13||i===16?yesterday:i===13?today:i===14?tomorrow:null}));
 }
 memberships.push(membership({id:"50000000-0000-4000-a000-999999999999",prospect_id:people[0].id,season_id:seasons[1].id,stage:"Confirmed for Tryouts",next_action:"Synthetic historical action",follow_up_date:yesterday}));
 for(let i=0;i<15;i++)activity.push({id:String(i).padStart(3,"0"),prospect_id:people[0].id,season_id:i===0?null:seasons[0].id,actor_name:"Synthetic Dashboard Captain",event_type:i===0?"prospect_updated":"workflow_updated",created_at:today+"T12:00:00Z",changes:{}});
 activity.push({id:"other-season",prospect_id:people[0].id,season_id:seasons[1].id,actor_name:"Synthetic cross-season author",event_type:"workflow_updated",created_at:today+"T13:00:00Z",changes:{}});
 activity.push({id:"excluded-person",prospect_id:people[16].id,season_id:null,actor_name:"Synthetic excluded author",event_type:"prospect_updated",created_at:today+"T14:00:00Z",changes:{}});
 return ()=>{people=original.people;memberships=original.memberships;activity=original.activity;};
}
test("dashboard shows actual date-boundary counts, blank actions, selected-season activity and pagination",async()=>{
 const restore=seedDashboard();
 try {
  const first=await(await get("/dashboard?season=2027","active")).text();
  for(const [label,count] of [["Unknown Prospect",6],["Known Prospect",5],["Confirmed for Tryouts",5],["Overdue follow-ups",13],["Upcoming follow-ups",2],["Missing owners",2],["Missing next actions",3]])assert.match(first,new RegExp(`aria-label="${label} count">${count}<`));
  assert.match(first,/Due today/);assert.match(first,/Today and later/);assert.match(first,/15<!-- --> events/);
  assert.doesNotMatch(first,/Synthetic cross-season author|Synthetic excluded author|Synthetic Dashboard 16/);
  assert.match(first,/season=2027&amp;overdue=2#overdue/);
  const second=await(await get("/dashboard?season=2027&overdue=2&activity=2","active")).text();
  assert.match(second,/Synthetic Dashboard 12/);assert.match(second,/Shared player facts/);
  assert.match(second,/season=2027&amp;activity=2#overdue/);
  const clamped=await(await get("/dashboard?season=2027&overdue=999999","active")).text();assert.match(clamped,/Synthetic Dashboard 12/);
  const historical=await(await get("/dashboard?season=2026","active")).text();assert.match(historical,/Historical records are read-only/);assert.match(historical,/Synthetic Dashboard 16/);assert.match(historical,/Synthetic cross-season author/);assert.match(historical,/3<!-- --> events/);
 }finally{restore();}
});
test("dashboard provider failure displays an error instead of invented zero counts",async()=>{
 dashboardUnavailable=true;
 try{const html=await(await get("/dashboard","active")).text();assert.match(html,/error|unavailable/i);assert.doesNotMatch(html,/No overdue follow-ups|Every prospect in this season/);}finally{dashboardUnavailable=false;}
});
test("dashboard empty state reports zero real records without fabricating work",async()=>{
 const original={people,memberships,activity};people=[];memberships=[];activity=[];
 try{
  const html=await(await get("/dashboard?season=2027","active")).text();
  for(const label of ["Unknown Prospect","Known Prospect","Confirmed for Tryouts"])assert.match(html,new RegExp(`aria-label="${label} count">0<`));
  for(const message of ["No overdue follow-ups","No upcoming follow-ups","Every prospect in this season has an assigned owner","Every prospect in this season has a next action","No recorded activity for this season yet"])assert.match(html,new RegExp(message));
 }finally{people=original.people;memberships=original.memberships;activity=original.activity;}
});
test("hydrated dashboard navigates queues and historical context without mobile overflow",{skip:process.env.BLUEPRINT_BROWSER_QA!=="1",timeout:120_000},async()=>{
 const restore=seedDashboard();const run=promisify(execFile);
 const browser=async(...args:string[])=>(await run("npx",["--yes","agent-browser@0.38.1",...args],{env:{...process.env,AGENT_BROWSER_SESSION:"blueprint-phase4-ci"},timeout:40_000,maxBuffer:2_000_000})).stdout;
 await mkdir(".qa",{recursive:true});
 try {
  await browser("open",appOrigin+"/login");const cookie=sessionCookie("active");const separator=cookie.indexOf("=");
  await browser("cookies","set",cookie.slice(0,separator),cookie.slice(separator+1),"--url",appOrigin);
  await browser("open",appOrigin+"/dashboard?season=2027");await browser("wait",'section[id="overdue"]');
  const initial=await browser("snapshot");for(const title of ["Overdue follow-ups","Upcoming follow-ups","Missing owners","Missing next actions","Recent activity","Due today"])assert.ok(initial.includes(title),title);
  await browser("screenshot",resolve(".qa/phase4-dashboard-desktop.png"),"--full");assert.ok((await stat(".qa/phase4-dashboard-desktop.png")).size>0);
  await browser("click",'#overdue nav a');await browser("wait","--text","Synthetic Dashboard 12");assert.match(await browser("get","url"),/season=2027.*overdue=2/);
  await browser("click",'#upcoming li:first-child a');await browser("wait",'select[name="stage"]');assert.match(await browser("get","url"),/prospects\/.*season=2027/);
  await browser("open",appOrigin+"/dashboard?season=2026");await browser("wait","--text","Historical records are read-only");assert.match(await browser("snapshot"),/Synthetic Dashboard 16/);
  await browser("set","viewport","390","844");await browser("open",appOrigin+"/dashboard?season=2027");await browser("wait",'#activity');
  await browser("screenshot",resolve(".qa/phase4-dashboard-mobile.png"),"--full");assert.ok((await stat(".qa/phase4-dashboard-mobile.png")).size>0);
  const dimensions=JSON.parse(await browser("eval","({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})","--json")).data.result;assert.ok(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));
  assert.deepEqual(JSON.parse(await browser("errors","--json")).data.errors,[]);assert.doesNotMatch(await browser("console"),/hydration|Minified React|Uncaught/i);
  dashboardUnavailable=true;await browser("open",appOrigin+"/dashboard");await browser("wait","--text","Something isn’t available right now.");assert.doesNotMatch(await browser("snapshot"),/No overdue follow-ups|Every prospect in this season/);
 }finally{dashboardUnavailable=false;restore();await browser("close");}
});

const naRatings=Object.fromEntries(ratingKeys.map(key=>[key,null]));
const naEntry=Object.fromEntries(ratingKeys.map(key=>[key,"na"]));
const historicalEvaluationCandidacy="33333333-3333-4333-a333-333333333333";
function seedEvaluations() {
 const original={evaluations,memberships,activity};
 const timestamp="2026-09-18T00:00:00Z";
 memberships=[...memberships.filter(row=>row.prospect_id!==syntheticId||row.season_id!==seasons[1].id),membership({id:historicalEvaluationCandidacy,season_id:seasons[1].id})];
 evaluations=[{...naRatings,id:"22222222-2222-4222-a222-222222222222",candidacy_id:syntheticCandidacyId,evaluator_id:ownerId,evaluator_name:"Synthetic Other Evaluator",athleticism:1,defensive_ability:5,on_field_vibes:4,version:1,created_at:timestamp,updated_at:timestamp},
  {...naRatings,id:"11111111-2222-4222-a222-222222222222",candidacy_id:historicalEvaluationCandidacy,evaluator_id:ids.active,evaluator_name:"Synthetic Historical Evaluator",athleticism:5,version:1,created_at:timestamp,updated_at:timestamp}];
 activity=[];
 return ()=>{evaluations=original.evaluations;memberships=original.memberships;activity=original.activity;};
}
const evaluationPath="/prospects/"+syntheticId+"?season=2027";
async function evaluationForm(){return formFromHtml(await(await get(evaluationPath,"active")).text(),'name="athleticism"');}
async function postEvaluation(form:FormData,values:Record<string,string>={},kind:keyof typeof ids="active") {
 Object.entries({...naEntry,...values}).forEach(([key,value])=>form.set(key,value));
 return fetch(appOrigin+evaluationPath,{method:"POST",body:form,redirect:"manual",signal:AbortSignal.timeout(15000),headers:{Cookie:sessionCookie(kind),Origin:appOrigin}});
}
test("other evaluations and N/A averages are visible before submitting; historical ratings stay separate",async()=>{
 const restore=seedEvaluations();
 try {
  const html=await(await get(evaluationPath,"active")).text();
  for(const text of ["Synthetic Other Evaluator","Submit evaluation","Evaluator comparison","Individual submitted ratings","Attribute averages","Choose rating"])assert.ok(html.includes(text),text);
  assert.match(html,/aria-label="Athleticism average">1.00 \/ 5</);assert.match(html,/aria-label="Offensive Ability average">N\/A</);assert.doesNotMatch(html,/Synthetic Historical Evaluator/);
  const historical=await(await get("/prospects/"+syntheticId+"?season=2026","active")).text();assert.match(historical,/Synthetic Historical Evaluator/);assert.match(historical,/Historical evaluations.*Read-only/);assert.doesNotMatch(historical,/Submit evaluation|Update evaluation|Synthetic Other Evaluator/);
 }finally{restore();}
});
test("native evaluation submission and edits persist N/A, trusted author, averages and attributed activity",async()=>{
 const restore=seedEvaluations();
 try {
  const submitted=await postEvaluation(await evaluationForm(),{athleticism:"5",offensive_ability:"4",evaluator_id:ownerId,evaluator_name:"Forged author"});assert.equal(submitted.status,303);assert.match(submitted.headers.get("location")!,/season=2027#evaluations/);
  const row=evaluations.find(row=>row.candidacy_id===syntheticCandidacyId&&row.evaluator_id===ids.active)!;assert.equal(row.evaluator_name,"Synthetic Captain");assert.equal(row.defensive_ability,null);assert.equal(row.athleticism,5);assert.equal(row.version,1);
  const html=await(await get(evaluationPath,"active")).text();assert.match(html,/aria-label="Athleticism average">3.00 \/ 5</);assert.match(html,/Synthetic Captain.*\(you\)/);assert.match(html,/Evaluation submitted/);assert.doesNotMatch(html,/Forged author/);
  const updated=await postEvaluation(await evaluationForm(),{athleticism:"3",offensive_ability:"4",coachability:"2"});assert.equal(updated.status,303);assert.equal(row.version,2);assert.equal(row.coachability,2);
  const timeline=await(await get(evaluationPath,"active")).text();assert.match(timeline,/Evaluation updated/);assert.match(timeline,/aria-label="Athleticism average">2.00 \/ 5</);
  const before=activity.length;await postEvaluation(await evaluationForm(),{athleticism:"3",offensive_ability:"4",coachability:"2"});assert.equal(row.version,2);assert.equal(activity.length,before);
  assert.ok(activity.every(event=>event.season_id===seasons[0].id));
  assert.match(await(await get("/dashboard?season=2027","active")).text(),/Evaluation updated/);
 }finally{restore();}
});
test("evaluation forms reject blank, zero and fractional choices without writing",async()=>{
 const restore=seedEvaluations();const before=evaluationWrites;
 try {for(const athleticism of ["","0","6","2.5"]){const response=await postEvaluation(await evaluationForm(),{athleticism});assert.equal(response.status,200);assert.match(await response.text(),/Choose 1–5 or N\/A for every attribute/);}assert.equal(evaluationWrites,before);assert.equal(evaluations.length,2);}finally{restore();}
});
test("duplicate first submissions and stale evaluation edits preserve the current ratings",async()=>{
 const restore=seedEvaluations();
 try {
  const first=await evaluationForm();const second=await evaluationForm();assert.equal((await postEvaluation(first,{athleticism:"5"})).status,303);
  const duplicate=await postEvaluation(second,{athleticism:"1"});assert.equal(duplicate.status,200);assert.match(await duplicate.text(),/Your evaluation changed in another tab/);
  const stale=await evaluationForm();const row=evaluations.find(row=>row.evaluator_id===ids.active&&row.candidacy_id===syntheticCandidacyId)!;row.version=2;row.athleticism=4;
  const response=await postEvaluation(stale,{athleticism:"1"});assert.equal(response.status,200);assert.match(await response.text(),/Your evaluation changed in another tab/);assert.equal(row.athleticism,4);
 }finally{restore();}
});
test("evaluation comparison pages keep full averages and the editable own row",async()=>{
 const restore=seedEvaluations();
 try {
  assert.equal((await postEvaluation(await evaluationForm(),{athleticism:"5"})).status,303);
  for(let i=0;i<27;i++)evaluations.push({...naRatings,id:"synthetic-page-"+i,candidacy_id:syntheticCandidacyId,evaluator_id:"synthetic-evaluator-"+i,evaluator_name:"Synthetic Page Evaluator "+String(i).padStart(2,"0"),version:1,created_at:"2026-09-18T00:00:00Z",updated_at:"2026-09-18T00:00:00Z"});
  const html=await(await get(evaluationPath+"&evaluationPage=2","active")).text();assert.match(html,/Edit your evaluation/);assert.match(html,/aria-label="Athleticism average">3.00 \/ 5</);assert.match(html,/season=2027&amp;evaluationPage=1#evaluations/);assert.match(html,/Synthetic Page Evaluator 26/);
  const clamped=await(await get(evaluationPath+"&evaluationPage=999999","active")).text();assert.match(clamped,/Synthetic Page Evaluator 26/);
 }finally{restore();}
});
test("captured evaluation actions deny revocation and closure; evaluation outages never invent empty averages",async()=>{
 const restore=seedEvaluations();const before=evaluationWrites;
 try {
  const form=await evaluationForm();const inactive=await postEvaluation(form,{},"inactive");assert.equal(new URL(inactive.headers.get("location")!,appOrigin).pathname,"/login");
  revoked=true;try{const denied=await postEvaluation(form);assert.equal(new URL(denied.headers.get("location")!,appOrigin).pathname,"/login");}finally{revoked=false;}
  seasons[0].status="closed";try{const response=await postEvaluation(form);assert.equal(response.status,200);assert.match(await response.text(),/Historical seasons are read-only/);}finally{seasons[0].status="active";}
  assert.equal(evaluationWrites,before);
  evaluationsUnavailable=true;try{const html=await(await get(evaluationPath,"active")).text();assert.match(html,/error|unavailable/i);assert.doesNotMatch(html,/No evaluations submitted|Attribute averages/);}finally{evaluationsUnavailable=false;}
 }finally{restore();}
});
test("hydrated evaluations submit N/A, edit ratings and display comparison without mobile overflow",{skip:process.env.BLUEPRINT_BROWSER_QA!=="1",timeout:120_000},async()=>{
 const restore=seedEvaluations();const run=promisify(execFile);
 const browser=async(...args:string[])=>(await run("npx",["--yes","agent-browser@0.38.1",...args],{env:{...process.env,AGENT_BROWSER_SESSION:"blueprint-phase5-ci"},timeout:40_000,maxBuffer:2_000_000})).stdout;
 await mkdir(".qa",{recursive:true});
 try {
  await browser("open",appOrigin+"/login");const cookie=sessionCookie("active");const separator=cookie.indexOf("=");await browser("cookies","set",cookie.slice(0,separator),cookie.slice(separator+1),"--url",appOrigin);
  await browser("open",appOrigin+evaluationPath);await browser("wait",'select[name="athleticism"]');assert.match(await browser("snapshot"),/Synthetic Other Evaluator/);assert.match(await browser("get","text",'[aria-label="Athleticism average"]'),/1.00/);
  for(const key of ratingKeys)await browser("select",`select[name="${key}"]`,key==="athleticism"?"5":"na");
  await browser("find","role","button","click","--name","Submit evaluation");await browser("wait","--text","Edit your evaluation");assert.match(await browser("get","text",'[aria-label="Athleticism average"]'),/3.00/);
  const own=evaluations.find(row=>row.evaluator_id===ids.active&&row.candidacy_id===syntheticCandidacyId)!;assert.equal(own.athleticism,5);assert.ok(ratingKeys.filter(key=>key!=="athleticism").every(key=>own[key]===null));
  await browser("select",'select[name="athleticism"]',"3");await browser("select",'select[name="coachability"]',"2");await browser("find","role","button","click","--name","Update evaluation");await browser("wait","--text","Evaluation updated");assert.equal(own.version,2);assert.equal(own.athleticism,3);assert.equal(own.coachability,2);assert.match(await browser("get","text",'[aria-label="Athleticism average"]'),/2.00/);
  await browser("screenshot",resolve(".qa/phase5-evaluations-desktop.png"),"--full");assert.ok((await stat(".qa/phase5-evaluations-desktop.png")).size>0);
  await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2026");assert.match(await browser("snapshot"),/Synthetic Historical Evaluator/);assert.doesNotMatch(await browser("snapshot","-i"),/Submit evaluation|Update evaluation/);
  await browser("set","viewport","390","844");await browser("open",appOrigin+evaluationPath);await browser("wait",'#evaluations');await browser("screenshot",resolve(".qa/phase5-evaluations-mobile.png"),"--full");assert.ok((await stat(".qa/phase5-evaluations-mobile.png")).size>0);
  const layout=JSON.parse(await browser("eval","({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tableWidth:document.querySelector('[aria-label=\"Individual evaluations comparison table\"]').scrollWidth})","--json")).data.result;assert.ok(layout.scrollWidth<=layout.width+1,JSON.stringify(layout));assert.ok(layout.tableWidth>layout.width,"Comparison scrolls within its container");
  assert.deepEqual(JSON.parse(await browser("errors","--json")).data.errors,[]);assert.doesNotMatch(await browser("console"),/hydration|Minified React|Uncaught/i);
 }finally{restore();await browser("close");}
});

// Phase 6 continuity: real server actions, synthetic provider and isolated records.
async function postNative(form:FormData,path:string,kind:keyof typeof ids="active") {return fetch(appOrigin+path,{method:"POST",body:form,headers:{Cookie:sessionCookie(kind),Origin:appOrigin},redirect:"manual"});}
function seedHistory() {
 const saved={seasons:seasons.map(row=>({...row})),people:people.map(row=>({...row})),memberships:memberships.map(row=>({...row})),evaluations:evaluations.map(row=>({...row})),activity:activity.map(row=>({...row}))};
 memberships=[membership({}),membership({id:"33333333-3333-4333-a333-333333333333",season_id:seasons.find(s=>s.year===2026)!.id,stage:"Confirmed for Tryouts",outcome:"Cut–Encourage to Return",owner_id:ownerId,projection_year_one:"Synthetic previous outlook"})];
 evaluations=[];activity=[];
 return ()=>{seasons.splice(0,seasons.length,...saved.seasons);people=saved.people;memberships=saved.memberships;evaluations=saved.evaluations;activity=saved.activity;};
}
test("season outcomes save separately, log trusted changes, reject stale edits and preserve history",async()=>{
 const restore=seedHistory();try{
 const path="/prospects/"+syntheticId+"?season=2027";const html=await(await get(path,"active")).text();assert.match(html,/Previous recorded season/);assert.match(html,/Cut–Encourage to Return/);
 const form=formFromHtml(html,'name="outcome"');form.set("outcome","Rostered");const stale=formFromHtml(html,'name="outcome"');stale.set("outcome","Practice Player");
 const response=await postNative(form,path);assert.equal(response.status,303);assert.equal(memberships[0].stage,"Unknown Prospect");assert.equal(memberships[0].outcome,"Rostered");assert.equal(memberships[1].outcome,"Cut–Encourage to Return");assert.equal(activity[0].actor_name,"Synthetic Captain");assert.deepEqual((activity[0].changes as Record<string,unknown>).outcome,{from:null,to:"Rostered"});
 const denied=await postNative(stale,path);assert.match(await denied.text(),/Reload the profile/);assert.equal(memberships[0].outcome,"Rostered");
 const invalid=formFromHtml(await(await get(path,"active")).text(),'name="outcome"');invalid.set("outcome","Confirmed for Tryouts");assert.match(await(await postNative(invalid,path)).text(),/valid season outcome/);
 }finally{restore();}
});
test("starting and closing seasons preserves records, confirms the year and freezes captured forms",async()=>{
 const restore=seedHistory();try{
 const profilePath="/prospects/"+syntheticId+"?season=2027";const outcome=formFromHtml(await(await get(profilePath,"active")).text(),'name="outcome"');outcome.set("outcome","Rostered");
 const workflow=await workflowForm();const evaluation=await evaluationForm();const settings=await(await get("/settings","active")).text();
 const wrong=formFromHtml(settings,'name="confirm_year"');wrong.set("confirm_year","2026");assert.match(await(await postNative(wrong,"/settings")).text(),/exact season year/);assert.equal(seasons[0].status,"active");
 const start=formFromHtml(settings,'name="new_season_year"');start.set("new_season_year","2028");assert.equal((await postNative(start,"/settings")).status,303);assert.equal(seasons[0].year,2028);assert.equal(seasons[0].is_current,true);assert.equal(seasons.find(s=>s.year===2027)!.status,"active");
 const close=formFromHtml(settings,'name="confirm_year"');close.set("confirm_year","2027");assert.equal((await postNative(close,"/settings")).status,303);const closed=seasons.find(s=>s.year===2027)!;assert.equal(closed.status,"closed");assert.equal(closed.closed_by_name,"Synthetic Captain");assert.ok(closed.closed_at);assert.equal(memberships[0].outcome,null);
 assert.match(await(await postNative(outcome,profilePath)).text(),/Historical seasons are read-only/);assert.match(await(await postWorkflow(workflow,{})).text(),/Historical seasons are read-only/);assert.match(await(await postEvaluation(evaluation,{})).text(),/Historical seasons are read-only/);
 const history=await(await get(profilePath,"active")).text();assert.doesNotMatch(history,/<select name="outcome"/);assert.doesNotMatch(history,/Submit evaluation|Save recruiting details/);assert.equal(memberships.length,2);
 }finally{restore();}
});
test("historical profile adds the same person to a new season with fresh fields and idempotent membership",async()=>{
 const restore=seedHistory();try{
 memberships=memberships.filter(row=>row.season_id===seasons[1].id);const beforePeople=people.length;const old=JSON.stringify(memberships[0]);
 const path="/prospects/"+syntheticId+"?season=2026";const html=await(await get(path,"active")).text();assert.match(html,/Add to 2027/);
 const form=formFromHtml(html,"Add to 2027");const response=await postNative(form,path);assert.equal(response.status,303);assert.match(response.headers.get("location")!,/season=2027/);assert.equal(people.length,beforePeople);assert.equal(memberships.length,2);assert.equal(JSON.stringify(memberships[0]),old);
 const fresh=memberships[1];assert.equal(fresh.prospect_id,syntheticId);assert.equal(fresh.stage,"Unknown Prospect");for(const key of ["outcome","owner_id","priority","next_action","follow_up_date","projection_year_one","projection_year_two","projection_year_three"])assert.equal(fresh[key],null);assert.equal(evaluations.length,0);
 assert.equal((await postNative(form,path)).status,303);assert.equal(memberships.length,2);assert.doesNotMatch(await(await get(path,"active")).text(),/Add to 2027/);
 }finally{restore();}
});
test("season management and outcome actions reject revoked and inactive leadership",async()=>{
 const restore=seedHistory();try{
 const settings=await(await get("/settings","active")).text();const form=formFromHtml(settings,'name="new_season_year"');form.set("new_season_year","2028");revoked=true;
 try{const response=await postNative(form,"/settings");assert.equal(new URL(response.headers.get("location")!,appOrigin).pathname,"/login");}finally{revoked=false;}
 const response=await postNative(form,"/settings","inactive");assert.equal(new URL(response.headers.get("location")!,appOrigin).pathname,"/login");assert.equal(seasons.length,2);
 const path="/prospects/"+syntheticId+"?season=2027";const outcome=formFromHtml(await(await get(path,"active")).text(),'name="outcome"');outcome.set("outcome","Rostered");const denied=await postNative(outcome,path,"inactive");assert.equal(new URL(denied.headers.get("location")!,appOrigin).pathname,"/login");assert.equal(memberships[0].outcome,null);
 }finally{restore();}
});
test("hydrated historical continuity saves an outcome, starts and closes a season, then reuses a person",{skip:process.env.BLUEPRINT_BROWSER_QA!=="1",timeout:120_000},async()=>{
 const restore=seedHistory();const run=promisify(execFile);const browser=async(...args:string[])=>(await run("npx",["--yes","agent-browser@0.38.1",...args],{env:{...process.env,AGENT_BROWSER_SESSION:"blueprint-phase6-ci"},timeout:40_000,maxBuffer:2_000_000})).stdout;
 await mkdir(".qa",{recursive:true});try{
 await browser("open",appOrigin+"/login");const cookie=sessionCookie("active");const separator=cookie.indexOf("=");await browser("cookies","set",cookie.slice(0,separator),cookie.slice(separator+1),"--url",appOrigin);
 await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2027");await browser("wait",'select[name="outcome"]');await browser("select",'select[name="outcome"]',"Practice Player");await browser("find","role","button","click","--name","Save outcome");await browser("wait","--text","Recruiting workflow updated");assert.equal(memberships[0].outcome,"Practice Player");
 await browser("open",appOrigin+"/settings");await browser("fill",'input[name="new_season_year"]',"2028");await browser("find","role","button","click","--name","Start new season");await browser("wait","--url","**/dashboard?season=2028");assert.equal(seasons[0].year,2028);
 await browser("open",appOrigin+"/settings");await browser("fill",'input[placeholder="2027"]',"2027");await browser("find","role","button","click","--name","Close 2027 season");await browser("wait","--text","UTC by Synthetic Captain");assert.equal(seasons.find(s=>s.year===2027)!.status,"closed");
 await browser("open",appOrigin+"/prospects/"+syntheticId+"?season=2027");await browser("wait","--text","Historical season");assert.doesNotMatch(await browser("snapshot","-i"),/Save outcome|Save recruiting details|Submit evaluation/);await browser("find","role","button","click","--name","Add to 2028");await browser("wait","--url","**/prospects/"+syntheticId+"?season=2028");await browser("wait",'select[name="outcome"]');assert.equal(memberships.find(row=>row.season_id===seasons[0].id)!.outcome,null);assert.match(await browser("snapshot"),/Practice Player|Previous recorded season/);
 await browser("screenshot",resolve(".qa/phase6-continuity-desktop.png"),"--full");await browser("set","viewport","390","844");await browser("open",appOrigin+"/settings");await browser("wait",'input[name="new_season_year"]');await browser("screenshot",resolve(".qa/phase6-seasons-mobile.png"),"--full");assert.ok((await stat(".qa/phase6-continuity-desktop.png")).size>0);assert.ok((await stat(".qa/phase6-seasons-mobile.png")).size>0);
 const layout=JSON.parse(await browser("eval","({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})","--json")).data.result;assert.ok(layout.scrollWidth<=layout.width+1,JSON.stringify(layout));assert.deepEqual(JSON.parse(await browser("errors","--json")).data.errors,[]);assert.doesNotMatch(await browser("console"),/hydration|Minified React|Uncaught/i);
 }finally{restore();await browser("close");}
});

// Static demo does not enter either Auth or the private provider, even anonymously.
test('anonymous synthetic demo assets never query the private provider or grant workspace access',async()=>{
 const before=validatedIdentities;
 for(const path of ['/demo/index.html','/demo/app.mjs','/demo/data.mjs','/demo/style.css']) {
  const response=await get(path);assert.equal(response.status,200,path);const source=await response.text();assert.doesNotMatch(source,/sb_publishable_|sb_secret_|Synthetic Captain/);
 }
 const entry=await get('/demo');assert.equal(entry.status,307);assert.equal(new URL(entry.headers.get('location')!,appOrigin).pathname,'/demo/index.html');
 assert.equal(validatedIdentities,before,'Static demo must not call Auth');
 const denied=await get('/dashboard');assert.equal(new URL(denied.headers.get('location')!,appOrigin).pathname,'/login');
});
test('the portfolio demo contains ten fictional people, separate historical data and no private data routes',async()=>{
 const html=await(await get('/demo/index.html')).text();assert.match(html,/Synthetic demo|SYNTHETIC PORTFOLIO DEMO/);assert.match(html,/Every person and rating is invented/);
 const source=await(await get('/demo/data.mjs')).text();const data=JSON.parse(source.replace(/^export const demoData = /,'').replace(/;\n$/,''));assert.equal(data.prospects.length,10);assert.equal(data.prospects[0].seasons[1].status,'closed');assert.equal(data.prospects[0].seasons[1].outcome,'Cut–Encourage to Return');assert.equal(data.prospects[0].seasons[0].outcome,null);
});
test('hydrated anonymous demo navigates counts, search, N/A comparisons and history without backend access',{skip:process.env.BLUEPRINT_BROWSER_QA!=='1',timeout:120_000},async()=>{
 const run=promisify(execFile);const browser=async(...args:string[])=>(await run('npx',['--yes','agent-browser@0.38.1',...args],{env:{...process.env,AGENT_BROWSER_SESSION:'blueprint-phase7-demo-ci'},timeout:40_000,maxBuffer:2_000_000})).stdout;
 const before=validatedIdentities;await mkdir('.qa',{recursive:true});try{
  await browser('open',appOrigin+'/demo/');await browser('wait','main .metrics');assert.match(await browser('snapshot'),/Synthetic demo|Every person and rating is invented/);
  const counts=JSON.parse(await browser('eval',"Array.from(document.querySelectorAll('.metrics strong')).map(item=>Number(item.textContent))",'--json')).data.result;assert.deepEqual(counts,[4,3,3]);
  await browser('screenshot',resolve('.qa/phase7-demo-desktop.png'),'--full');
  await browser('click','nav a[href="#prospects"]');await browser('wait','#search');await browser('fill','#search','Demo Prospect 01');assert.doesNotMatch(await browser('get','text','main table'),/Demo Prospect 02/);
  await browser('find','role','link','click','--name','Demo Prospect 01');await browser('wait','.averages');assert.match(await browser('get','text','.averages .average:first-child'),/3.50/);assert.match(await browser('snapshot'),/N\/A|Previous recorded season/);
  await browser('select','#season','2026');assert.match(await browser('snapshot'),/Cut–Encourage to Return/);assert.match(await browser('get','text','.averages .average:first-child'),/3.00/);assert.doesNotMatch(await browser('snapshot','-i'),/Save outcome|Submit evaluation|Edit prospect/);
  await browser('set','viewport','390','844');await browser('screenshot',resolve('.qa/phase7-demo-mobile.png'),'--full');
  const layout=JSON.parse(await browser('eval','({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})','--json')).data.result;assert.ok(layout.scrollWidth<=layout.width+1,JSON.stringify(layout));
  const resources=JSON.parse(await browser('eval',"performance.getEntriesByType('resource').map(item=>item.name)",'--json')).data.result;assert.ok(resources.every((url:string)=>!url.includes('/rest/v1')&&!url.includes('/auth/v1')&&!url.includes('supabase')));assert.equal(validatedIdentities,before);
  assert.deepEqual(JSON.parse(await browser('errors','--json')).data.errors,[]);assert.doesNotMatch(await browser('console'),/Uncaught|hydration|Minified React/i);assert.ok((await stat('.qa/phase7-demo-desktop.png')).size>0);assert.ok((await stat('.qa/phase7-demo-mobile.png')).size>0);
 }finally{await browser('close');}
});

test('phase 8 browser review covers login, empty data and provider errors at desktop and mobile',{skip:process.env.BLUEPRINT_BROWSER_QA!=='1',timeout:120_000},async()=>{
 const run=promisify(execFile);const browser=async(...args:string[])=>(await run('npx',['--yes','agent-browser@0.38.1',...args],{env:{...process.env,AGENT_BROWSER_SESSION:'blueprint-phase8-verification-ci'},timeout:40_000,maxBuffer:2_000_000})).stdout;
 const original={people,memberships,activity};await mkdir('.qa',{recursive:true});
 const layout=async()=>JSON.parse(await browser('eval','({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})','--json')).data.result;
 try{
  await browser('set','viewport','1280','900');await browser('open',appOrigin+'/login');await browser('wait','--text','Welcome back.');
  let snapshot=await browser('snapshot');assert.match(snapshot,/Sign in with Google|individual Google account/);assert.doesNotMatch(snapshot,/Workspace setup is still in progress/);
  await browser('screenshot',resolve('.qa/phase8-login-desktop.png'),'--full');let size=await layout();assert.ok(size.scrollWidth<=size.width+1,JSON.stringify(size));
  await browser('set','viewport','390','844');await browser('open',appOrigin+'/login');await browser('wait','--text','Welcome back.');
  await browser('screenshot',resolve('.qa/phase8-login-mobile.png'),'--full');size=await layout();assert.ok(size.scrollWidth<=size.width+1,JSON.stringify(size));
  const cookie=sessionCookie('active');const separator=cookie.indexOf('=');await browser('cookies','set',cookie.slice(0,separator),cookie.slice(separator+1),'--url',appOrigin);
  people=[];memberships=[];activity=[];await browser('open',appOrigin+'/dashboard?season=2027');await browser('wait','--text','No overdue follow-ups');
  snapshot=await browser('snapshot');assert.match(snapshot,/No recorded activity for this season yet/);assert.match(snapshot,/Every prospect in this season has an assigned owner/);
  await browser('screenshot',resolve('.qa/phase8-empty-mobile.png'),'--full');size=await layout();assert.ok(size.scrollWidth<=size.width+1,JSON.stringify(size));
  assert.deepEqual(JSON.parse(await browser('errors','--json')).data.errors,[]);assert.doesNotMatch(await browser('console'),/hydration|Minified React|Uncaught/i);
  dashboardUnavailable=true;await browser('open',appOrigin+'/dashboard');await browser('wait','--text','Something isn’t available right now.');
  snapshot=await browser('snapshot');assert.match(snapshot,/Try again/);assert.doesNotMatch(snapshot,/No overdue follow-ups|Every prospect in this season/);
  await browser('screenshot',resolve('.qa/phase8-error-mobile.png'),'--full');size=await layout();assert.ok(size.scrollWidth<=size.width+1,JSON.stringify(size));
  for(const name of ['phase8-login-desktop.png','phase8-login-mobile.png','phase8-empty-mobile.png','phase8-error-mobile.png'])assert.ok((await stat(resolve('.qa',name))).size>0);
 }finally{dashboardUnavailable=false;people=original.people;memberships=original.memberships;activity=original.activity;await browser('close');}
});
