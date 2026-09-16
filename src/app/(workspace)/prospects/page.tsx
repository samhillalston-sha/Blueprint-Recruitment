import { UsersRound, ArrowRight } from "lucide-react";
import Link from "next/link";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Prospects" };
export default async function Prospects({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  await requireLeadership();
  const season = selectSeason(await getSeasons(), (await searchParams).season);
  return <div><div className="page-heading"><div><span className="eyebrow text-primary">Prospect workspace / {season?.year ?? "No season"}</span><h1>People first. Pipeline second.</h1><p>This is where your team’s recruiting knowledge will come together.</p></div><span className="status-tag">Not yet connected</span></div><section className="panel mt-9 flex min-h-96 flex-col items-center justify-center px-6 py-16 text-center"><div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-primary"><UsersRound size={32} strokeWidth={1.4} /></div><span className="eyebrow text-muted-foreground">Coming in the next phase</span><h2 className="mt-3 text-2xl font-semibold tracking-tight">A home for every prospect.</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Prospect records, search, filters, and recruiting ownership will be added after Phase 1 is approved. This screen is intentionally a placeholder, not a live database.</p><Button asChild variant="outline" className="mt-7"><Link href={`/dashboard${season ? `?season=${season.year}` : ""}`}>Back to dashboard <ArrowRight size={15} /></Link></Button></section></div>;
}
