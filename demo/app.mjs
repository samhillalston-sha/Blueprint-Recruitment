import {demoData as data} from './data.mjs';
const main=document.querySelector('#main');const selector=document.querySelector('#season');let year=data.currentYear;
const escape=value=>String(value??'Not set').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const record=person=>person.seasons.find(row=>row.year===year);
const link=person=>`<a href="#prospect/${person.id}">${escape(person.name)}</a>`;
const people=()=>data.prospects.filter(person=>record(person));
const panel=(title,body,caption='')=>`<section class="panel"><div class="heading"><h2>${title}</h2><span>${caption}</span></div>${body}</section>`;
const field=(label,value)=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
const heading=(title,subtitle)=>`<span class="eyebrow">BLUEPRINT RECRUITING / DEMO</span><h1>${title}</h1><p class="subtitle">${subtitle}</p>`;
const queue=(title,rows)=>panel(title,rows.length?rows.map(person=>`<div class="row"><div>${link(person)}<p>${escape(record(person).stage)} · ${escape(record(person).nextAction??'No next action')}</p></div><span class="muted">${escape(record(person).followUp??'Unscheduled')}</span></div>`).join(''):'<p class="empty">None in this sample.</p>',rows.length+' prospects');
function dashboard(){
 const rows=people();const filter=fn=>rows.filter(person=>fn(record(person)));
 const metrics=data.stages.map(stage=>`<div class="metric"><p>${stage}</p><strong>${filter(row=>row.stage===stage).length}</strong><p>${year} recruiting season</p></div>`).join('');
 return heading('Build the next chapter.',`Recruiting at a glance for ${year}. ${year===2026?'Historical sample · Read-only.':'Sample dates use January 15, 2027.'}`)+`<div class="metrics">${metrics}</div><div class="grid">${queue('Overdue follow-ups',filter(row=>row.followUp&&row.followUp<data.today))}${queue('Upcoming follow-ups',filter(row=>row.followUp&&row.followUp>=data.today))}${queue('Missing owners',filter(row=>!row.owner))}${queue('Missing next actions',filter(row=>!row.nextAction?.trim()))}</div>`+panel('Recent activity',`<div class="content timeline"><p><strong>Illustrative activity</strong> · ${escape(data.leaders[1])} · ${year} Season</p><p>Follow-up date: Not set → ${year}-01-18</p><p class="muted">This is invented sample activity, not a production audit event.</p></div>`);
}
function prospectList(query=''){
 const rows=people().filter(person=>person.name.toLowerCase().includes(query.toLowerCase()));
 return heading('A shared recruiting memory.',`Fictional people with separate seasonal records. ${year} Season · ${rows.length} sample prospects.`)+`<label class="search">Search names<input id="search" type="search" placeholder="Search the fictional prospects" value="${escape(query)}"></label>`+panel('Prospect database',`<div class="table-scroll" role="region" aria-label="Demo prospect table" tabindex="0"><table><thead><tr><th>Name</th><th>Stage</th><th>Outcome</th><th>Owner</th><th>Next action</th><th>Follow-up</th></tr></thead><tbody>${rows.map(person=>{const row=record(person);return `<tr><td>${link(person)}<p class="muted">${person.position} · ${person.location}</p></td><td>${escape(row.stage)}</td><td>${escape(row.outcome)}</td><td>${escape(row.owner??'Unassigned')}</td><td>${escape(row.nextAction)}</td><td>${escape(row.followUp)}</td></tr>`;}).join('')}</tbody></table></div>${!rows.length?'<p class="empty">No matching fictional prospects.</p>':''}`);
}
function profile(id){
 const person=data.prospects.find(person=>person.id===id);if(!person)return heading('Sample prospect unavailable.','Choose a fictional person from the prospect database.');
 const row=record(person);const prior=person.seasons.filter(row=>row.year<year).sort((a,b)=>b.year-a.year)[0];
 let html=`<a class="text-link" href="#prospects">Back to prospects</a>`+heading(escape(person.name),'One fictional person, with a separate record for each sample season.')+panel('Player facts',`<dl class="content">${field('Email',person.email)}${field('Location',person.location)}${field('Teams',person.teams)}${field('Position',person.position)}</dl>`,'Shared across seasons');
 if(row){
 html+=panel(`Recruiting workflow · ${year}`,`<dl class="content">${field('Stage',row.stage)}${field('Priority',row.priority)}${field('Owner',row.owner??'Unassigned')}${field('Follow-up date',row.followUp)}${field('Next action',row.nextAction)}${row.projections.map((value,index)=>field((year+index)+' · Year '+(index+1)+' projection',value)).join('')}</dl>`,'Read-only sample');
 html+=panel('Season outcome',`<p class="content">${escape(row.outcome)} · Separate from recruiting stage</p>`);
 }
 if(prior)html+=panel('Previous recorded season · '+prior.year,`<div class="content"><p>Stage: ${escape(prior.stage)}</p><p>Outcome: ${escape(prior.outcome)}</p><a href="#prospect/${person.id}" data-year="${prior.year}">View the ${prior.year} record</a></div>`);
 html+=panel('Season history',`<div class="content">${person.seasons.map(item=>`<p><a href="#prospect/${person.id}" data-year="${item.year}">${item.year} Season</a> · ${item.status==='closed'?'Historical':'Active'} · ${escape(item.outcome)}</p>`).join('')}<p class="muted">Production can add this same person to a later active season with fresh workflow and evaluations. This portfolio sample cannot write records.</p></div>`);
 if(row){const evaluations=row.evaluations;
 const averages=data.attributes.map((attribute,index)=>{const values=evaluations.map(e=>e.scores[index]).filter(value=>value!==null);const average=values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)+' / 5':'N/A';return `<div class="average"><h3>${attribute}</h3><strong>${average}</strong><small>${values.length} rated · ${evaluations.length-values.length} N/A</small></div>`;}).join('');
 html+=panel(`Evaluations · ${year}`,`<div class="content"><p class="muted">All sample scores are invented. N/A is excluded from each attribute’s average.</p><div class="averages">${averages}</div></div><div class="table-scroll" role="region" aria-label="Demo evaluator comparison" tabindex="0"><table><thead><tr><th>Evaluator</th>${data.attributes.map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>${evaluations.map(e=>`<tr><td>${escape(e.name)}</td>${e.scores.map(score=>`<td>${score??'N/A'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${!evaluations.length?'<p class="empty">No sample evaluations submitted.</p>':''}`,evaluations.length+' submitted');}
 return html;
}
function history(){return heading('Keep the memory. Start fresh.', 'Shared people, distinct seasons, preserved evaluations.')+panel('Season continuity',`<div class="content"><p><span class="tag">2027 · Active</span></p><p>Recruiting stages, owners, next actions, outcomes and evaluations belong to the selected season.</p><p><span class="tag">2026 · Closed</span></p><p>Earlier workflow and ratings stay visible and read-only. Closing does not invent missing outcomes or clear history.</p><p>Production leadership can confirm closure by typing the season year and add an existing person to a later active season. The new membership starts with fresh fields and no copied evaluations.</p><p><a href="#prospect/${data.prospects[0].id}">Explore ${escape(data.prospects[0].name)} across seasons</a></p><p class="muted">This self-contained sample has no Google login, database, import, or write endpoint. All ten people are fictional.</p></div>`);}
function render(){
 const route=location.hash.slice(1)||'dashboard';document.querySelectorAll('[data-nav]').forEach(item=>{const active=item.dataset.nav===(route.startsWith('prospect/')?'prospects':route);item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
 main.innerHTML=route==='prospects'?prospectList():route==='history'?history():route.startsWith('prospect/')?profile(route.split('/')[1]):dashboard();
}
main.addEventListener('input',event=>{
 if(event.target.id!=='search')return;
 const value=event.target.value;const caret=event.target.selectionStart;
 main.innerHTML=prospectList(value);
 const replacement=document.querySelector('#search');replacement.focus();replacement.setSelectionRange(caret,caret);
});
selector.addEventListener('change',()=>{year=Number(selector.value);render();});
document.addEventListener('click',event=>{const target=event.target.closest('a[data-year]');if(target){event.preventDefault();year=Number(target.dataset.year);selector.value=String(year);location.hash=target.getAttribute('href').slice(1);render();}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});render();
