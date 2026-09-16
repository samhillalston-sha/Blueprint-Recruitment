"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { selectSeason, type Season } from "@/lib/season-policy";

export function SeasonSelector({ seasons }: { seasons: Season[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = selectSeason(seasons, params.get("season") ?? undefined);
  return <div className="relative flex items-center gap-2 rounded-md border border-border bg-white px-3">
    <CalendarDays size={15} className="text-muted-foreground" />
    <label htmlFor="season" className="sr-only">Recruiting season</label>
    <select id="season" className="h-10 min-w-32 appearance-none bg-transparent pr-7 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary" value={selected?.year ?? ""} disabled={!seasons.length} onChange={event => {
      const next = new URLSearchParams(params.toString());
      next.set("season", event.target.value);
      router.push(`${pathname}?${next.toString()}`);
    }}>{!seasons.length && <option value="">No seasons</option>}{seasons.map(season => <option key={season.id} value={season.year}>{season.name}{season.is_current ? " · Current" : ""}</option>)}</select>
    <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted-foreground" />
  </div>;
}
