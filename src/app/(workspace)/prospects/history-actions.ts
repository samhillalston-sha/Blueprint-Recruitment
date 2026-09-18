"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { isUuid } from "@/lib/prospect-policy";
import { outcomeSchema, type HistoryFormState } from "@/lib/history-policy";
export async function saveOutcome(prospectId:string,seasonId:string,candidacyId:string,version:number,_previous:HistoryFormState,form:FormData):Promise<HistoryFormState> {
 const {client}=await requireLeadership();
 const outcome=outcomeSchema.safeParse(form.get("outcome"));
 if(![prospectId,seasonId,candidacyId].every(isUuid)||!Number.isSafeInteger(version)||version<1||!outcome.success) return {error:"Choose a valid season outcome."};
 const {data:season,error:seasonError}=await client.from("seasons").select("year,status").eq("id",seasonId).maybeSingle();
 if(seasonError||!season||season.status!=="active") return {error:"Historical seasons are read-only. Choose an active season."};
 const {data,error}=await client.from("candidacies").update({outcome:outcome.data}).eq("id",candidacyId).eq("prospect_id",prospectId).eq("season_id",seasonId).eq("version",version).select("id").maybeSingle();
 if(error||!data) return {error:"The record, season or your access changed. Reload the profile before saving."};
 revalidatePath("/prospects");revalidatePath("/prospects/"+prospectId);revalidatePath("/dashboard");
 redirect("/prospects/"+prospectId+"?season="+season.year);
}
