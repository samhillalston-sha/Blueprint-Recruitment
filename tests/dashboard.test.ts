import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardPage, dashboardHref, followUpLabel } from "../src/lib/dashboard-policy";

test("compact follow-up labels compare UTC dates across month and leap-year boundaries",()=>{
 assert.equal(followUpLabel("2027-01-15","2027-01-15"),"Due today");
 assert.equal(followUpLabel("2027-01-14","2027-01-15"),"1 day overdue");
 assert.equal(followUpLabel("2027-01-11","2027-01-15"),"4 days overdue");
 assert.equal(followUpLabel("2027-02-01","2027-01-31"),"Due tomorrow");
 assert.equal(followUpLabel("2028-03-01","2028-02-28"),"Due in 2 days");
});

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
