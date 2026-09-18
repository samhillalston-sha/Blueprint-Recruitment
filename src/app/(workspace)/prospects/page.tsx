import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { listProspects } from "@/lib/prospects";
import { getRecruitingLeaders } from "@/lib/workflows";
import { followUpStatus } from "@/lib/workflow-policy";

export const metadata = { title: "Prospects" };
export default async function Prospects({ searchParams }: { searchParams: Promise<{ season?: string; q?: string; page?: string; view?: string }> }) {
 await requireLeadership();
 const params = await searchParams;
 const season = selectSeason(await getSeasons(),params.season);
 const all = params.view === "all";
 const q = typeof params.q === "string" ? params.q.slice(0,120) : "";
 const page = /^\d+$/.test(params.page ?? "") ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
 const [{ rows, count },leaders] = await Promise.all([listProspects(season?.id ?? null,q,page,all),getRecruitingLeaders()]);
 const query = "?season=" + (season?.year ?? "");
 const pageUrl = (next: number) => "/prospects" + query + "&view=" + (all ? "all" : "season") + "&q=" + encodeURIComponent(q) + "&page=" + next;
 return <div className="space-y-6">
  <div className="page-heading"><div><span className="eyebrow text-primary">Prospect workspace / {season?.year ?? "No season"}</span><h1>A home for every prospect.</h1><p>Shared player facts, with recruiting history preserved across seasons.</p></div>
   {season?.status === "active" ? <Button asChild><Link href={"/prospects/new" + query}>Create prospect</Link></Button> : <span className="status-tag">Historical season · Read-only</span>}
  </div>
  <form method="get" className="panel flex flex-wrap items-end gap-4 p-5">
   <input type="hidden" name="season" value={season?.year ?? ""} />
   <label className="flex-1 text-sm font-medium">Search names<input name="q" defaultValue={q} maxLength={120} className="mt-2 h-10 w-full rounded-md border border-border px-3" /></label>
   <label className="text-sm font-medium">Show<select name="view" defaultValue={all ? "all" : "season"} className="mt-2 block h-10 rounded-md border border-border px-3"><option value="season">Selected season</option><option value="all">All people / every season</option></select></label>
   <Button type="submit">Apply</Button>
  </form>
  <section className="panel"><div className="section-heading"><h2>{all ? "All prospect records" : season?.name ?? "Prospects"}</h2><span className="text-xs text-muted-foreground">{count} {count === 1 ? "prospect" : "prospects"}</span></div>
   {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="p-4">Name</th><th scope="col" className="p-4">Stage</th><th scope="col" className="p-4">Outcome</th><th scope="col" className="p-4">Priority</th><th scope="col" className="p-4">Owner</th><th scope="col" className="p-4">Next action</th><th scope="col" className="p-4">Follow-up</th></tr></thead>
    <tbody>{rows.map(person => { const workflow = person.candidacies?.find(row => row.season_id === season?.id); const owner = leaders.find(leader => leader.id === workflow?.owner_id); return <tr key={person.id} className="border-t border-border"><td className="min-w-40 p-4"><Link className="font-semibold text-primary underline" href={"/prospects/" + person.id + query}>{person.full_name}</Link><p className="mt-1 text-xs text-muted-foreground">{person.position ?? "Unknown position"} · {person.location ?? "Unknown location"}</p></td><td className="p-4">{workflow?.stage ?? "Not in selected season"}</td><td className="p-4">{workflow?.outcome ?? "Not set"}</td><td className="p-4">{workflow?.priority ?? "Not set"}</td><td className="p-4">{owner ? (owner.full_name || "Leadership member") + (owner.is_active ? "" : " (inactive)") : "Unassigned"}</td><td className="max-w-xs whitespace-pre-wrap break-words p-4">{workflow?.next_action ?? "—"}</td><td className="p-4">{workflow?.follow_up_date ?? "—"}{workflow?.follow_up_date && season?.status === "active" && <p className="mt-1 text-xs font-semibold text-muted-foreground">{followUpStatus(workflow.follow_up_date)}</p>}</td></tr>; })}</tbody></table></div>
    : <p className="p-8 text-sm text-muted-foreground">{q ? "No prospects match this name." : all ? "No prospect records yet." : "No prospects in this season yet. Browse all people to reuse an existing profile, or create a new prospect in an active season."}</p>}
  </section>
  {(count > 50 || page > 1) && <nav aria-label="Prospect pages" className="flex items-center gap-4 text-sm">{page > 1 && <Link className="text-primary underline" href={pageUrl(page-1)}>Previous</Link>}<span>Page {page}</span>{page*50 < count && <Link className="text-primary underline" href={pageUrl(page+1)}>Next</Link>}</nav>}
 </div>;
}
