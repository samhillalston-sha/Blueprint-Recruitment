import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AddToSeason } from "@/components/prospect-form";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { getProspect } from "@/lib/prospects";
import { getCandidacies, getRecruitingLeaders, getActivity } from "@/lib/workflows";
import { followUpStatus } from "@/lib/workflow-policy";
import { WorkflowForm } from "@/components/workflow-form";
import { ActivityTimeline } from "@/components/activity-timeline";
import { saveWorkflow } from "../workflow-actions";

import { addToSeason } from "../actions";
export const metadata = { title: "Prospect profile" };
export default async function ProspectProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string; activityPage?: string }> }) {
 await requireLeadership();
 const person = await getProspect((await params).id);
 const seasons = await getSeasons();
 const search = await searchParams;
 const season = selectSeason(seasons,search.season);
 const page = /^\d+$/.test(search.activityPage ?? "") ? Math.max(1,Math.min(10000,Number(search.activityPage))) : 1;
 const [memberships, leaders, activity] = await Promise.all([getCandidacies(person.id),getRecruitingLeaders(),getActivity(person.id,page)]);
 const candidacy = memberships.find(row => row.season_id === season?.id);
 const inSeason = memberships.some(row => row.season_id === season?.id);
 const query = season ? "?season=" + season.year : "";
 const facts = [["Email",person.email],["Phone",person.phone],["Location",person.location],["Teams",person.teams],["Position",person.position],["Age",person.age],["Height (cm)",person.height_cm]];
 const safeLink = person.social_url && /^https?:\/\//i.test(person.social_url) ? person.social_url : null;
 return <div className="space-y-6">
  <Link className="text-sm text-primary underline" href={"/prospects" + query}>Back to prospects</Link>
  <div className="page-heading"><div><span className="eyebrow text-primary">Prospect profile</span><h1>{person.full_name}</h1><p>One person, with a separate record for each recruiting season.</p></div>
   {season?.status === "active" ? <Button asChild><Link href={"/prospects/" + person.id + "/edit" + query}>Edit prospect</Link></Button> : <span className="status-tag">Historical season · Read-only</span>}
  </div>
  <section className="panel"><div className="section-heading"><h2>Player facts</h2><span className="text-xs text-muted-foreground">Shared across seasons</span></div><dl className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">{facts.map(([label,value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{value ?? "Unknown"}</dd></div>)}
   <div><dt className="text-xs text-muted-foreground">Social / profile link</dt><dd className="mt-2 break-all text-sm">{safeLink ? <a className="text-primary underline" href={safeLink} target="_blank" rel="noopener noreferrer">{safeLink}</a> : "Unknown"}</dd></div></dl>
   <p className="border-t border-border p-4 text-xs text-muted-foreground">Created {new Date(person.created_at).toLocaleDateString("en-US",{timeZone:"UTC"})} · Updated {new Date(person.updated_at).toLocaleDateString("en-US",{timeZone:"UTC"})}</p>
  </section>
  {candidacy && season && <section className="panel"><div className="section-heading"><h2>Recruiting workflow · {season.name}</h2><span className="status-tag">{season.status === "active" ? "Season-specific" : "Historical · Read-only"}</span></div>
   {season.status === "active" ? <WorkflowForm candidacy={candidacy} leaders={leaders} year={season.year} saveAction={saveWorkflow.bind(null,person.id,season.id,candidacy.id,candidacy.version)} />
    : <dl className="grid gap-6 p-6 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Recruiting stage</dt><dd className="mt-2 text-sm">{candidacy.stage}</dd></div><div><dt className="text-xs text-muted-foreground">Priority</dt><dd className="mt-2 text-sm">{candidacy.priority ?? "Not set"}</dd></div><div><dt className="text-xs text-muted-foreground">Owner</dt><dd className="mt-2 text-sm">{leaders.find(leader => leader.id === candidacy.owner_id)?.full_name || "Unassigned"}</dd></div><div><dt className="text-xs text-muted-foreground">Follow-up date</dt><dd className="mt-2 text-sm">{candidacy.follow_up_date ?? "Not set"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Next action</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{candidacy.next_action ?? "Not set"}</dd></div>{(["projection_year_one","projection_year_two","projection_year_three"] as const).map((key,index) => <div key={key}><dt className="text-xs text-muted-foreground">{season.year+index} · Year {index+1} projection</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{candidacy[key] ?? "Not set"}</dd></div>)}</dl>}
   {season.status === "active" && candidacy.follow_up_date && <p className="border-t border-border px-6 py-4 text-xs text-muted-foreground">{followUpStatus(candidacy.follow_up_date)} · {candidacy.follow_up_date} (UTC calendar date)</p>}
  </section>}
  <section className="panel"><div className="section-heading"><h2>Season history</h2></div><div className="space-y-4 p-6">
   <p className="text-sm">{inSeason ? "Included in " : "Not included in "}{season?.name ?? "a selected season"}.</p>
   {!inSeason && season?.status === "active" && <AddToSeason addAction={addToSeason.bind(null,person.id,season.id)} />}
   <ul className="space-y-3">{seasons.filter(item => memberships.some(row => row.season_id === item.id)).map(item => <li key={item.id}><Link className="text-sm font-semibold text-primary underline" href={"/prospects/" + person.id + "?season=" + item.year}>{item.name}</Link><span className="ml-3 text-xs text-muted-foreground">{item.status === "closed" ? "Historical" : "Active"} · {memberships.find(row => row.season_id === item.id)?.stage}</span></li>)}</ul>
   {!memberships.length && <p className="text-sm text-muted-foreground">No season records yet.</p>}
  </div></section>
  <ActivityTimeline rows={activity.rows} count={activity.count} page={page} seasons={seasons} profileUrl={"/prospects/" + person.id + "?season=" + (season?.year ?? "")} />
  <p className="text-xs text-muted-foreground">Season membership records recruiting history. It is not a tryout confirmation or a roster offer.</p>
 </div>;
}
