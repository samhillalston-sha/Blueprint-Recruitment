import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('synthetic demo builds without environment variables, database or authentication clients',()=>{
 execFileSync(process.execPath,['scripts/build-demo.mjs'],{env:{PATH:process.env.PATH,NODE_ENV:"test"}});
 const app=readFileSync('public/demo/app.mjs','utf8');const data=readFileSync('public/demo/data.mjs','utf8');
 assert.doesNotMatch(app+data,/supabase|service_role|publishable_|getUser|requireLeadership|fetch\(|XMLHttpRequest|\/rest\/v1/i);
 assert.match(readFileSync('public/demo/index.html','utf8'),/Every name, team, scenario, and rating is invented/);
 const dataset=JSON.parse(data.replace(/^export const demoData = /,'').replace(/;\n$/,''));assert.equal(dataset.prospects.length,10);
 assert.equal(new Set(dataset.prospects.map((person:{name:string})=>person.name)).size,10);
 for(const person of dataset.prospects){assert.match(person.name,/^[A-Z][a-z]+ [A-Z][a-z]+$/);assert.doesNotMatch(person.name,/Demo Prospect/i);assert.match(person.email,/@example\.com$/);for(const row of person.seasons)for(const evaluation of row.evaluations)assert.ok(evaluation.scores.every((rating:number|null)=>rating===null||Number.isInteger(rating)&&rating>=1&&rating<=5));}
 assert.deepEqual(dataset.prospects.slice(0,3).map((person:{name:string})=>person.name),['Darius Holloway','Evan Mercer','Malik Rowan']);
 assert.equal(dataset.prospects[0].seasons.length,2);assert.equal(dataset.prospects[9].seasons[0].evaluations.length,0);
});
