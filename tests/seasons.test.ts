import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { selectSeason, type Season } from "../src/lib/season-policy";

const seasons: Season[] = [
  { id: "current", name: "2027 Season", year: 2027, is_current: true, status: "active" },
  { id: "history", name: "2026 Season", year: 2026, is_current: false, status: "closed" },
];
test("current season is the default; historical seasons can be selected", () => {
  assert.equal(selectSeason(seasons)?.year, 2027);
  assert.equal(selectSeason(seasons, "2026")?.year, 2026);
});
test("invalid season input falls back safely and empty seasons are handled", () => {
  assert.equal(selectSeason(seasons, "garbage")?.year, 2027);
  assert.equal(selectSeason(seasons, "2025")?.year, 2027);
  assert.equal(selectSeason([]), null);
  assert.equal(selectSeason([{ ...seasons[1] }])?.year, 2026);
});
test("foundation SQL contains only two protected tables and no client writes", () => {
  const path = readdirSync("supabase/migrations").find(name => name.endsWith("phase_one_foundation.sql"))!;
  const sql = readFileSync(`supabase/migrations/${path}`, "utf8");
  assert.deepEqual([...sql.matchAll(/create table public\.(\w+)/g)].map(match => match[1]), ["profiles", "seasons"]);
  assert.match(sql, /is_active boolean not null default false/);
  for (const table of ["profiles", "seasons"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.doesNotMatch(sql, /grant\s+(all|insert|update|delete)/i);
  assert.match(sql, /create function private\.bootstrap_profile/);
  assert.match(sql, /new\.email, false/);
});
