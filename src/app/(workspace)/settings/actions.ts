"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { seasonYearSchema, type HistoryFormState } from "@/lib/history-policy";
import { isUuid } from "@/lib/prospect-policy";
function refreshSeasons() { revalidatePath("/settings"); revalidatePath("/dashboard"); revalidatePath("/prospects", "layout"); }
export async function startSeason(_previous:HistoryFormState,form:FormData):Promise<HistoryFormState> {
 const {client}=await requireLeadership();
 const year=seasonYearSchema.safeParse(form.get("new_season_year"));
 if(!year.success) return {error:"Enter a season year between 2000 and 2100."};
 const {data,error}=await client.rpc("start_season",{p_year:year.data});
 if(error||typeof data!=="string") return {error:"Could not start the season. Choose a year after the latest existing season, or reload to check your access."};
 refreshSeasons(); redirect("/dashboard?season="+year.data);
}
export async function closeSeason(seasonId:string,year:number,_previous:HistoryFormState,form:FormData):Promise<HistoryFormState> {
 const {client}=await requireLeadership();
 if(!isUuid(seasonId)||String(form.get("confirm_year"))!==String(year)) return {error:"Type the exact season year to confirm closure."};
 const {data,error}=await client.rpc("close_season",{p_season_id:seasonId,p_confirm_year:year});
 if(error||typeof data!=="string") return {error:"Could not close the season. Reload to check its status and your access."};
 refreshSeasons(); redirect("/settings");
}
