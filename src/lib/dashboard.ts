import "server-only";
import { requireLeadership } from "./auth/require-leadership";
import { dashboardKeys, dashboardPage, type DashboardParams, type RecruitingDashboard } from "./dashboard-policy";

export async function getDashboard(seasonId: string, params: DashboardParams): Promise<RecruitingDashboard> {
 const { client } = await requireLeadership();
 const pages = Object.fromEntries(dashboardKeys.map(key => [key,dashboardPage(params[key])]));
 const { data, error } = await client.rpc("recruiting_dashboard",{p_season_id:seasonId,p_pages:pages});
 if (error || !data) throw new Error("The recruiting dashboard is temporarily unavailable.");
 return data as RecruitingDashboard;
}
