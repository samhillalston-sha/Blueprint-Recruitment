import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardPage, dashboardHref } from "../src/lib/dashboard-policy";

test("dashboard pagination rejects malformed and oversized input",()=>{
 for(const value of [undefined,["2","3"],"-1","2.5","NaN","9999999","1e3"]) assert.equal(dashboardPage(value),1);
 assert.equal(dashboardPage("0"),1);
 assert.equal(dashboardPage("23"),23);
});
test("queue pagination preserves the selected season and other queue pages",()=>{
 const pages={overdue:2,upcoming:3,owners:1,actions:1,activity:4};
 assert.equal(dashboardHref(2026,pages,"overdue",1),"/dashboard?season=2026&upcoming=3&activity=4#overdue");
 assert.equal(dashboardHref(2027,pages,"actions",2),"/dashboard?season=2027&overdue=2&upcoming=3&actions=2&activity=4#actions");
});
