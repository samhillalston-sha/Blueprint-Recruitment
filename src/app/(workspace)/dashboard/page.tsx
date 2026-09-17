import Link from "next/link";
import { ArrowRight, CircleHelp, UserRoundCheck, Flag, ScanLine } from "lucide-react";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { Button } from "@/components/ui/button";
import { getPipeline } from "@/lib/workflows";

export const metadata = { title: "Dashboard" };
const stages = [
  { name: "Unknown Prospect", caption: "Names on our radar. More to learn.", icon: CircleHelp, tone: "bg-slate-100 text-slate-500" },
  { name: "Known Prospect", caption: "Players we know and want to explore.", icon: UserRoundCheck, tone: "bg-blue-50 text-primary" },
  { name: "Confirmed for Tryouts", caption: "Interested, and confirmed to attend.", icon: Flag, tone: "bg-blue-100 text-blue-800" },
];
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  await requireLeadership(); // Page-level guard too: don't rely on middleware/layout alone.
  const season = selectSeason(await getSeasons(), (await searchParams).season);
  const query = season ? `?season=${season.year}` : "";
  const counts = await getPipeline(season?.id ?? null);
  return <div className="space-y-9">
    <div className="page-heading"><div><span className="eyebrow text-primary">Recruiting overview / {season?.year ?? "No season"}</span><h1>Your recruiting blueprint.</h1><p>A shared view of the people who could be part of what’s next.</p></div><span className="status-tag">{season?.status === "closed" ? "Historical season" : "Offseason recruiting"}</span></div>
    <section aria-labelledby="pipeline-title"><div className="mb-4 flex items-center justify-between"><h2 id="pipeline-title" className="text-sm font-semibold">The recruiting pipeline</h2><span className="text-xs text-muted-foreground">{season?.name ?? "Select a season"}</span></div><div className="grid gap-4 md:grid-cols-3">{stages.map(({ name, caption, icon: Icon, tone },index) => <article key={name} className="panel p-6"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{name}</span><div className={`rounded-md p-2 ${tone}`}><Icon size={16} /></div></div><p className="mt-5 text-4xl font-medium tracking-tight" aria-label={name + " count"}>{counts[index]}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{caption}</p></article>)}</div><p className="mt-3 text-[11px] text-muted-foreground">Counts reflect the selected season. Tryout confirmation is not a roster offer.</p></section>
    <section className="foundation-banner blueprint-grid" aria-labelledby="foundation-title"><div className="relative z-10 max-w-xl"><span className="eyebrow text-blue-200">Recruiting workflow</span><h2 id="foundation-title" className="mt-4 text-2xl font-semibold tracking-tight">Turn recruiting knowledge into action.</h2><p className="mt-3 text-sm leading-6 text-blue-100/80">Set stages, priorities, and owners. Plan your next action, follow-up date, and three-year outlook. Every important change appears in the activity timeline.</p><Button asChild variant="outline" className="mt-6"><Link href={`/prospects${query}`}>View prospect workspace <ArrowRight size={15} /></Link></Button></div><ScanLine size={112} strokeWidth={0.65} className="absolute right-10 top-1/2 hidden -translate-y-1/2 text-blue-200/30 xl:block" /></section>
    <div className="grid gap-4 md:grid-cols-2"><section className="panel p-6"><span className="eyebrow text-muted-foreground">One shared workspace</span><h2 className="mt-3 text-base font-semibold">Keep leadership on the same page.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Active captains and coaches share the same access. Membership is managed privately through Supabase.</p></section><section className="panel p-6"><span className="eyebrow text-muted-foreground">Beyond a single season</span><h2 className="mt-3 text-base font-semibold">Build for the long game.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Prospect profiles preserve season membership across years. Player facts belong to the person; season records preserve recruiting history.</p></section></div>
  </div>;
}
