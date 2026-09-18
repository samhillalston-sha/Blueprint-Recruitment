// Entirely invented, deliberately labelled people. Never load private data here.
export const demoData = {
 currentYear:2027, today:'2027-01-15',
 leaders:['Demo Coach North','Demo Captain West','Demo Captain East'],
 attributes:['Athleticism','Offensive Ability','Defensive Ability','Coachability','On Field Vibes','Off Field Vibes'],
 stages:['Unknown Prospect','Known Prospect','Confirmed for Tryouts'],
 prospects:Array.from({length:10},(_,index)=>({
  id:'demo-'+(index+1),name:'Demo Prospect '+String(index+1).padStart(2,'0'),position:index%2?'Cutter':'Handler',location:'Fictional City',teams:'Fictional Club',email:'demo'+(index+1)+'@example.com',
  seasons:[{year:2027,status:'active',stage:['Unknown Prospect','Known Prospect','Confirmed for Tryouts'][index%3],priority:index<3?'High':index<6?'Medium':null,owner:index<2?null:['Demo Coach North','Demo Captain West','Demo Captain East'][index%3],nextAction:index<2?null:'Invite to a preseason throwing session',followUp:index<4?'2027-01-10':index<8?'2027-01-18':null,outcome:null,
   projections:['Develop a dependable reset role','Build confidence under pressure','Potential rotation contributor'],evaluations:index===9?[]:[{name:'Demo Coach North',scores:[4,3,null,5,4,4]},{name:'Demo Captain West',scores:index===8?[null,null,null,null,null,null]:[3,4,3,4,null,5]}]},
   ...(index<4?[{year:2026,status:'closed',stage:'Confirmed for Tryouts',priority:'Medium',owner:'Demo Captain East',nextAction:'Previous season outreach completed',followUp:'2026-03-01',outcome:index%2?'Practice Player':'Cut–Encourage to Return',projections:['Build fundamentals','Grow into a rotation role','Develop leadership habits'],evaluations:[{name:'Demo Captain East',scores:[3,3,2,4,null,4]}]}]:[])]
 }))
};
