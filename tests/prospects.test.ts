import assert from "node:assert/strict";
import test from "node:test";
import { parseProspect, normalizeName, escapeSearch } from "../src/lib/prospect-policy";
function form(values: Record<string,string>) { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data; }
test("name required; unknown facts stay null rather than becoming invented attributes", () => {
 assert.equal(parseProspect(form({})).success,false);
 const parsed = parseProspect(form({full_name:" Synthetic Player "}));
 assert.ok(parsed.success);
 assert.equal(parsed.data.full_name,"Synthetic Player");
 for (const key of ["email","phone","social_url","location","teams","age","height_cm","position"] as const) assert.equal(parsed.data[key],null);
});
test("reject invalid facts and unsafe links", () => {
 for (const values of [{position:"Hybrid"},{age:"15"},{age:"20.5"},{height_cm:"251"},{social_url:"javascript:alert(1)"},{email:"broken"},{full_name:"x".repeat(121)}]) {
  assert.equal(parseProspect(form({full_name:"Synthetic Player",...values})).success,false);
 }
 assert.equal(parseProspect(form({full_name:"Synthetic Player",position:"Handler",age:"29",height_cm:"182",social_url:"https://example.com/synthetic"})).success,true);
});
test("duplicate normalization and literal wildcard search", () => {
 assert.equal(normalizeName("  SYNTHETIC   Player  "),"synthetic player");
 assert.equal(escapeSearch("100%_"),"100\\%\\_");
});
