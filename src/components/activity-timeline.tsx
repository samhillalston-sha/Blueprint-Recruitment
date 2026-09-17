import Link from "next/link";
import { fieldLabels, eventLabels, type Activity } from "@/lib/workflow-policy";
import type { Season } from "@/lib/season-policy";

export function ActivityTimeline({ rows, count, page, seasons, profileUrl }: { rows: Activity[]; count: number; page: number; seasons: Season[]; profileUrl: string }) {
 return <section className="panel"><div className="section-heading"><h2>Activity timeline</h2><span className="text-xs text-muted-foreground">All seasons · {count} events</span></div>
  {rows.length ? <ol className="divide-y divide-border">{rows.map(event => <li key={event.id} className="p-6">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{eventLabels[event.event_type]}</h3><time dateTime={event.created_at} className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("en-US",{timeZone:"UTC"})} UTC</time></div>
   <p className="mt-2 text-xs text-muted-foreground">{event.actor_name} · {event.season_id ? seasons.find(season => season.id === event.season_id)?.name ?? "Recruiting season" : "Shared player facts"}</p>
   <dl className="mt-4 space-y-2">{Object.entries(event.changes).map(([field,change]) => <div key={field} className="text-sm"><dt className="font-medium">{fieldLabels[field] ?? field}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{field === "owner_id" ? change.from_label ?? (change.from ? "Leadership member" : "Unassigned") : change.from ?? "Not set"}<span className="mx-2" aria-label="changed to">→</span>{field === "owner_id" ? change.to_label ?? (change.to ? "Leadership member" : "Unassigned") : change.to ?? "Not set"}</dd></div>)}</dl>
  </li>)}</ol> : <p className="p-6 text-sm text-muted-foreground">{count ? "No activity on this page. Use Newer to return to recorded events." : "No recorded activity yet. New changes will appear here; earlier changes are not reconstructed."}</p>}
  {(count > 25 || page > 1) && <nav aria-label="Activity pages" className="flex gap-4 border-t border-border p-4 text-sm">{page > 1 && <Link className="text-primary underline" href={profileUrl + "&activityPage=" + (page-1)}>Newer</Link>}<span>Page {page}</span>{page*25 < count && <Link className="text-primary underline" href={profileUrl + "&activityPage=" + (page+1)}>Older</Link>}</nav>}
 </section>;
}
