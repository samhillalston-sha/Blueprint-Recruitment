import Link from "next/link";
import { dashboardHref, type DashboardKey, type DashboardPage, type DashboardRow } from "@/lib/dashboard-policy";
import { followUpStatus } from "@/lib/workflow-policy";

export function DashboardPagination({ data, year, pages, queue, title }: { data: DashboardPage<unknown>; year: number; pages: Record<DashboardKey,number>; queue: DashboardKey; title: string }) {
 if (data.count <= 10) return null;
 return <nav aria-label={`${title} pages`} className="flex flex-wrap items-center gap-4 border-t border-border p-4 text-xs">
  <span className="text-muted-foreground">Showing {(data.page-1)*10+1}–{Math.min(data.page*10,data.count)} of {data.count}</span>
  {data.page>1 && <Link className="text-primary underline" href={dashboardHref(year,pages,queue,data.page-1)}>Previous</Link>}
  {data.page*10<data.count && <Link className="text-primary underline" href={dashboardHref(year,pages,queue,data.page+1)}>Next</Link>}
 </nav>;
}
export function DashboardQueue({ queue, title, caption, empty, data, year, today, pages }: { queue: Exclude<DashboardKey,"activity">; title: string; caption: string; empty: string; data: DashboardPage<DashboardRow>; year: number; today: string; pages: Record<DashboardKey,number> }) {
 return <section id={queue} aria-labelledby={`${queue}-title`} className="panel min-w-0 scroll-mt-6">
  <div className="flex items-start justify-between gap-3 p-6"><div><h2 id={`${queue}-title`} className="text-sm font-semibold">{title}</h2><p className="mt-2 text-xs text-muted-foreground">{caption}</p></div><span className="text-2xl font-medium" aria-label={`${title} count`}>{data.count}</span></div>
  {data.rows.length ? <ul className="divide-y divide-border border-t border-border">{data.rows.map(row => <li key={row.id} className="p-6">
   <div className="flex flex-wrap items-start justify-between gap-2"><Link className="min-w-0 break-words text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/prospects/${row.prospect_id}?season=${year}`}>{row.full_name}</Link>{row.follow_up_date && <span className="text-xs text-muted-foreground">{followUpStatus(row.follow_up_date,today)} · <time dateTime={row.follow_up_date}>{row.follow_up_date}</time></span>}</div>
   <p className="mt-2 break-words text-xs text-muted-foreground">{row.stage}{row.priority ? ` · ${row.priority} priority` : ""}</p>
   <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.next_action?.trim() || "No next action set"}</p>
  </li>)}</ul> : <p className="border-t border-border p-6 text-sm text-muted-foreground">{empty}</p>}
  <DashboardPagination data={data} year={year} pages={pages} queue={queue} title={title}/>
 </section>;
}
