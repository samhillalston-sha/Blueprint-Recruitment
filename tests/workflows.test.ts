import { test } from "node:test";
import assert from "node:assert/strict";
import { workflowSchema, validFollowUpDate, followUpStatus } from "../src/lib/workflow-policy";
const blank={stage:"Unknown Prospect",priority:"",owner_id:"",next_action:"",follow_up_date:"",projection_year_one:"",projection_year_two:"",projection_year_three:""};
test("workflow leaves unknown values null and trims qualitative projections",()=>{
 const result=workflowSchema.parse({...blank,next_action:"  Call player  ",projection_year_two:"  Potential returning contributor  "});
 assert.equal(result.priority,null);assert.equal(result.owner_id,null);assert.equal(result.follow_up_date,null);
 assert.equal(result.next_action,"Call player");assert.equal(result.projection_year_one,null);assert.equal(result.projection_year_two,"Potential returning contributor");
});
test("stages, priorities and owners reject fabricated values",()=>{
 for(const values of [{stage:"Roster offer"},{priority:"Urgent"},{owner_id:"not-an-owner"}])assert.equal(workflowSchema.safeParse({...blank,...values}).success,false);
 assert.equal(workflowSchema.safeParse({...blank,stage:"Confirmed for Tryouts",priority:"High",owner_id:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}).success,true);
});
test("follow-up dates require a real calendar day, including leap years",()=>{
 for(const value of ["2026-02-29","2028-02-30","2026-04-31","2026-13-01","1999-12-31","2101-01-01","2026-1-02","junk"])assert.equal(validFollowUpDate(value),false,value);
 for(const value of ["2028-02-29","2000-01-01","2100-12-31"])assert.equal(validFollowUpDate(value),true,value);
 assert.equal(workflowSchema.safeParse({...blank,follow_up_date:"2026-02-30"}).success,false);
});
test("workflow text limits bound next actions and all three projections",()=>{
 assert.equal(workflowSchema.safeParse({...blank,next_action:"x".repeat(500)}).success,true);
 assert.equal(workflowSchema.safeParse({...blank,next_action:"x".repeat(501)}).success,false);
 for(const key of ["projection_year_one","projection_year_two","projection_year_three"]) {
  assert.equal(workflowSchema.safeParse({...blank,[key]:"x".repeat(1000)}).success,true);
  assert.equal(workflowSchema.safeParse({...blank,[key]:"x".repeat(1001)}).success,false);
 }
});
test("follow-up status compares calendar dates without timezone rollover",()=>{
 assert.equal(followUpStatus(null,"2026-09-17"),null);
 assert.equal(followUpStatus("2026-09-16","2026-09-17"),"Overdue");
 assert.equal(followUpStatus("2026-09-17","2026-09-17"),"Due today");
 assert.equal(followUpStatus("2026-09-18","2026-09-17"),"Upcoming");
});
