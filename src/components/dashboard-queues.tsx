import Link from "next/link";
import { dashboardHref, followUpLabel, type DashboardKey, type DashboardPage, type DashboardRow } from "@/lib/dashboard-policy";
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
 const compact = queue === "overdue" || queue === "upcoming";
 const compactRow = (row: DashboardRow) => <li key={row.id} className="px-5 py-3">
  <div className="flex items-start justify-between gap-3">
   <Link title={row.full_name} className="min-w-0 truncate text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/prospects/${row.prospect_id}?season=${year}`}>{row.full_name}</Link>
   {row.follow_up_date && <time dateTime={row.follow_up_date} title={row.follow_up_date} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${row.follow_up_date < today ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800"}`}>{followUpLabel(row.follow_up_date,today)}</time>}
  </div>
  <p title={row.next_action?.trim() || "No next action set"} className="mt-1 truncate text-xs leading-5 text-muted-foreground">{row.next_action?.trim() || "No next action set"}</p>
 </li>;
 return <section id={queue} aria-labelledby={`${queue}-title`} className="panel min-w-0 scroll-mt-6">
  <div className={`flex items-start justify-between gap-3 ${compact ? "px-5 py-4" : "p-6"}`}><div><h2 id={`${queue}-title`} className="text-sm font-semibold">{title}</h2><p className={compact ? "sr-only" : "mt-2 text-xs text-muted-foreground"}>{caption}</p></div><span className={compact ? "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold" : "text-2xl font-medium"} aria-label={`${title} count`}>{data.count}</span></div>
  {compact && data.rows.length ? <>
   <ul className="divide-y divide-border border-t border-border">{data.rows.slice(0,3).map(compactRow)}</ul>
   {data.count > 3 && <details open={data.page > 1} className="group border-t border-border">
    <summary className="cursor-pointer px-5 py-3 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"><span className="group-open:hidden">View all {data.count}</span><span className="hidden group-open:inline">Show fewer</span><span className="sr-only"> {title.toLowerCase()}</span></summary>
    {data.rows.length > 3 && <ul className="divide-y divide-border border-t border-border">{data.rows.slice(3).map(compactRow)}</ul>}
    <DashboardPagination data={data} year={year} pages={pages} queue={queue} title={title}/>
   </details>}
  </> : data.rows.length ? <ul className="divide-y divide-border border-t border-border">{data.rows.map(row => <li key={row.id} className="p-6">
   <div className="flex flex-wrap items-start justify-between gap-2"><Link className="min-w-0 break-words text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/prospects/${row.prospect_id}?season=${year}`}>{row.full_name}</Link>{row.follow_up_date && <span className="text-xs text-muted-foreground">{followUpStatus(row.follow_up_date,today)} · <time dateTime={row.follow_up_date}>{row.follow_up_date}</time></span>}</div>
   <p className="mt-2 break-words text-xs text-muted-foreground">{row.stage}{row.priority ? ` · ${row.priority} priority` : ""}</p>
   <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.next_action?.trim() || "No next action set"}</p>
  </li>)}</ul> : <p className="border-t border-border p-6 text-sm text-muted-foreground">{empty}</p>}
  {!compact && <DashboardPagination data={data} year={year} pages={pages} queue={queue} title={title}/>}
 </section>;
}
