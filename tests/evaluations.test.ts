import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluationSchema,evaluationAttributes,displayRating,evaluationPage } from "../src/lib/evaluation-policy";
const na=Object.fromEntries(evaluationAttributes.map(({key})=>[key,"na"]));
test("N/A is explicit, persists as null, and never becomes zero",()=>{
 const result=evaluationSchema.parse({...na,athleticism:"5",offensive_ability:"1"});
 assert.equal(result.athleticism,5);assert.equal(result.offensive_ability,1);assert.equal(result.coachability,null);
 assert.equal(displayRating(null),"N/A");assert.equal(displayRating(1),"1");
 assert.ok(Object.values(evaluationSchema.parse(na)).every(value=>value===null));
});
test("each attribute requires a whole 1–5 rating or an explicit N/A choice",()=>{
 for(const {key} of evaluationAttributes)for(const value of ["","0","6","-1","2.5","N/A","null",null,undefined])assert.equal(evaluationSchema.safeParse({...na,[key]:value}).success,false,`${key}: ${value}`);
 assert.equal(evaluationSchema.safeParse({}).success,false);
 assert.deepEqual(Object.keys(evaluationSchema.parse({...na,evaluator_id:"spoofed"})),evaluationAttributes.map(({key})=>key));
});
test("evaluation comparison page input is bounded and malformed pages default safely",()=>{
 for(const value of [undefined,"0","-1","2.5","1e3","9999999"])assert.equal(evaluationPage(value),1);
 assert.equal(evaluationPage("2"),2);
});
