import type { Activity } from "./workflow-policy";

export const dashboardKeys = ["overdue", "upcoming", "owners", "actions", "activity"] as const;
export type DashboardKey = typeof dashboardKeys[number];
export type DashboardParams = Partial<Record<DashboardKey | "season", string | string[]>>;
export type DashboardRow = { id: string; prospect_id: string; full_name: string; stage: string; priority: string | null; owner_id: string | null; next_action: string | null; follow_up_date: string | null };
export type DashboardPage<T> = { count: number; page: number; rows: T[] };
export type DashboardActivity = Pick<Activity, "id" | "season_id" | "actor_name" | "event_type" | "created_at"> & { prospect_id: string; full_name: string };
export type RecruitingDashboard = { today: string; stages: number[]; queues: Record<Exclude<DashboardKey,"activity">,DashboardPage<DashboardRow>>; activity: DashboardPage<DashboardActivity> };
export function dashboardPage(value: string | string[] | undefined) {
 return typeof value === "string" && /^[0-9]{1,6}$/.test(value) ? Math.max(1,Number(value)) : 1;
}
export function dashboardHref(year: number, pages: Record<DashboardKey,number>, key: DashboardKey, page: number) {
 const query = new URLSearchParams({season:String(year)});
 for (const name of dashboardKeys) if ((name === key ? page : pages[name]) > 1) query.set(name,String(name === key ? page : pages[name]));
 return `/dashboard?${query}#${key}`;
}
