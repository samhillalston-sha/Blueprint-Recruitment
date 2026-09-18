export type Season = { id: string; name: string; year: number; is_current: boolean; closed_at?: string | null; closed_by_name?: string | null; status: "active" | "closed" };
export function selectSeason(seasons: Season[], requested?: string): Season | null {
  return seasons.find(season => String(season.year) === requested)
    ?? seasons.find(season => season.is_current)
    ?? seasons.find(season => season.status === "active")
    ?? seasons[0] ?? null;
}
