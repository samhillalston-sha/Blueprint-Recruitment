import { z } from "zod";
import type { Season } from "./season-policy";
export const outcomes = ["Still Active", "Rostered", "Practice Player", "Cut–Encourage to Return", "Cut–Closed", "Withdrew/Chose Another Team", "Did Not Attend"] as const;
export const outcomeSchema = z.enum(["", ...outcomes]).transform(value => value || null);
export const seasonYearSchema = z.string().regex(/^\d{4}$/,"Enter a four-digit season year.").transform(Number).pipe(z.number().int().min(2000).max(2100));
export type HistoryFormState = { error?: string };
export type HistoryAction = (previous: HistoryFormState, form: FormData) => Promise<HistoryFormState>;
export function previousSeason(seasons: Season[], membershipSeasonIds: string[], selectedYear: number) {
 return [...seasons].filter(season => season.year < selectedYear && membershipSeasonIds.includes(season.id)).sort((a,b) => b.year-a.year)[0] ?? null;
}
export function newSeasonTargets(seasons: Season[], membershipSeasonIds: string[], sourceYear: number) {
 return seasons.filter(season => season.status === "active" && season.year > sourceYear && !membershipSeasonIds.includes(season.id)).sort((a,b) => a.year-b.year);
}
