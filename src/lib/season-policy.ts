export type Season = { id: string; name: string; year: number; is_current: boolean; status: "active" | "closed" };
export function selectSeason(seasons: Season[], requested?: string): Season | null {
  return seasons.find(season => String(season.year) === requested)
    ?? seasons.find(season => season.is_current)
    ?? seasons[0] ?? null;
}
