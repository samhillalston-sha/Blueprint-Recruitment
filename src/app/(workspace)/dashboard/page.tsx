import Link from "next/link";
import { ArrowRight, CircleHelp, UserRoundCheck, Flag } from "lucide-react";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/dashboard";
import { dashboardKeys, type DashboardParams } from "@/lib/dashboard-policy";
import { DashboardQueue, DashboardPagination } from "@/components/dashboard-queues";
import { eventLabels } from "@/lib/workflow-policy";

export const metadata = { title: "Dashboard" };
const stages = [
  { name: "Unknown Prospect", caption: "Names on our radar. More to learn.", icon: CircleHelp, tone: "bg-slate-100 text-slate-500" },
  { name: "Known Prospect", caption: "Players we know and want to explore.", icon: UserRoundCheck, tone: "bg-blue-50 text-primary" },
  { name: "Confirmed for Tryouts", caption: "Interested, and confirmed to attend.", icon: Flag, tone: "bg-blue-100 text-blue-800" },
];
export default async function Dashboard({ searchParams }: { searchParams: Promise<DashboardParams> }) {
  await requireLeadership(); // Page-level guard too: don't rely on middleware/layout alone.
  const [seasons, params] = await Promise.all([getSeasons(), searchParams]);
  const season = selectSeason(seasons, typeof params.season === "string" ? params.season : undefined);
  if (!season) return <div className="page-heading"><div><h1>Your recruiting blueprint.</h1><p>No seasons configured. Ask your workspace administrator to configure a season.</p></div></div>;
  const query = season ? `?season=${season.year}` : "";
  const dashboard = await getDashboard(season.id,params);
  const counts = dashboard.stages;
  const pages = Object.fromEntries(dashboardKeys.map(key => [key,key === "activity" ? dashboard.activity.page : dashboard.queues[key].page])) as Record<typeof dashboardKeys[number],number>;
  return <div className="space-y-9">
    <div className="page-heading"><div><span className="eyebrow text-primary">Recruiting overview / {season?.year ?? "No season"}</span><h1>Your recruiting blueprint.</h1><p>A shared view of the people who could be part of what’s next.</p></div><span className="status-tag">{season?.status === "closed" ? "Historical season" : "Offseason recruiting"}</span></div>
    <section aria-labelledby="pipeline-title"><div className="mb-4 flex items-center justify-between"><h2 id="pipeline-title" className="text-sm font-semibold">The recruiting pipeline</h2><span className="text-xs text-muted-foreground">{season?.name ?? "Select a season"}</span></div><div className="grid gap-4 md:grid-cols-3">{stages.map(({ name, caption, icon: Icon, tone },index) => <article key={name} className="panel p-6"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{name}</span><div className={`rounded-md p-2 ${tone}`}><Icon size={16} /></div></div><p className="mt-5 text-4xl font-medium tracking-tight" aria-label={name + " count"}>{counts[index]}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{caption}</p></article>)}</div><p className="mt-3 text-[11px] text-muted-foreground">Counts reflect the selected season. Tryout confirmation is not a roster offer.</p></section>
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted-foreground">Follow-ups are compared with <time dateTime={dashboard.today}>{dashboard.today}</time> (UTC).{season.status === "closed" ? " Historical records are read-only." : ""}</p><Button asChild variant="outline"><Link href={`/prospects${query}`}>View prospects <ArrowRight size={15}/></Link></Button></div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
     <DashboardQueue queue="overdue" title="Overdue follow-ups" caption="Follow-up dates before today" empty="No overdue follow-ups in this season." data={dashboard.queues.overdue} year={season.year} today={dashboard.today} pages={pages}/>
     <DashboardQueue queue="upcoming" title="Upcoming follow-ups" caption="Today and later, earliest dates first" empty="No upcoming follow-ups scheduled in this season." data={dashboard.queues.upcoming} year={season.year} today={dashboard.today} pages={pages}/>
     <DashboardQueue queue="owners" title="Missing owners" caption="Prospects without an assigned owner" empty="Every prospect in this season has an assigned owner." data={dashboard.queues.owners} year={season.year} today={dashboard.today} pages={pages}/>
     <DashboardQueue queue="actions" title="Missing next actions" caption="Prospects without a written next action" empty="Every prospect in this season has a next action." data={dashboard.queues.actions} year={season.year} today={dashboard.today} pages={pages}/>
    </div>
    <section id="activity" className="panel scroll-mt-6" aria-labelledby="recent-title">
     <div className="p-6"><h2 id="recent-title" className="text-sm font-semibold">Recent activity</h2><p className="mt-2 text-xs text-muted-foreground">Selected-season changes and shared player facts for this season’s prospects · {dashboard.activity.count} events</p></div>
     {dashboard.activity.rows.length ? <ol className="divide-y divide-border border-t border-border">{dashboard.activity.rows.map(event => <li key={event.id} className="p-6">
      <div className="flex flex-wrap justify-between gap-2"><Link className="break-words text-sm font-semibold text-primary hover:underline" href={`/prospects/${event.prospect_id}?season=${season.year}`}>{event.full_name}</Link><time className="text-xs text-muted-foreground" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en-US",{timeZone:"UTC"})} UTC</time></div>
      <p className="mt-2 text-sm">{eventLabels[event.event_type]}</p><p className="mt-2 break-words text-xs text-muted-foreground">{event.actor_name} · {event.season_id ? season.name : "Shared player facts"}</p>
     </li>)}</ol> : <p className="border-t border-border p-6 text-sm text-muted-foreground">No recorded activity for this season yet. New changes will appear here.</p>}
     <DashboardPagination data={dashboard.activity} year={season.year} pages={pages} queue="activity" title="Recent activity"/>
    </section>
  </div>;
}
