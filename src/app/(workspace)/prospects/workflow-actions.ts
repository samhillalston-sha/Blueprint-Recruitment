"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { isUuid } from "@/lib/prospect-policy";
import { workflowSchema, type WorkflowFormState } from "@/lib/workflow-policy";
import { getRecruitingLeaders } from "@/lib/workflows";

export async function saveWorkflow(prospectId: string, seasonId: string, candidacyId: string, expectedVersion: number, _previous: WorkflowFormState, form: FormData): Promise<WorkflowFormState> {
 const { client } = await requireLeadership();
 const raw = Object.fromEntries(Object.keys(workflowSchema.shape).map(key => [key,form.get(key) ?? ""]));
 const values = Object.fromEntries(Object.entries(raw).map(([key,value]) => [key,String(value).slice(0,1001)]));
 if (![prospectId,seasonId,candidacyId].every(isUuid) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return {values,error:"Invalid recruiting record."};
 const parsed = workflowSchema.safeParse(raw);
 if (!parsed.success) return {values,error:parsed.error.issues[0]?.message ?? "Check your recruiting details."};
 const { data: season, error: seasonError } = await client.from("seasons").select("id,year,status").eq("id",seasonId).maybeSingle();
 if (seasonError || !season) return {values,error:"Season information is unavailable."};
 if (season.status !== "active") return {values,error:"Historical seasons are read-only. Choose an active season."};
 const { data: current, error: currentError } = await client.from("candidacies").select("id,owner_id,version").eq("id",candidacyId).eq("prospect_id",prospectId).eq("season_id",seasonId).maybeSingle();
 if (currentError || !current) return {values,error:"Recruiting record is unavailable. Reload and try again."};
 if (current.version !== expectedVersion) return {values,error:"Another leader updated this record. Reload the profile to review their changes before saving."};
 // Existing revoked owners remain visible; a new assignment must be active.
 if (parsed.data.owner_id && parsed.data.owner_id !== current.owner_id) {
  const leaders = await getRecruitingLeaders();
  if (!leaders.some(leader => leader.id === parsed.data.owner_id && leader.is_active)) return {values,error:"Choose an approved active leadership owner."};
 }
 const { data, error } = await client.from("candidacies").update(parsed.data)
  .eq("id",candidacyId).eq("prospect_id",prospectId).eq("season_id",seasonId).eq("version",expectedVersion).select("id").maybeSingle();
 if (error) return {values,error:"Could not save recruiting details. The season or owner approval may have changed; reload and try again."};
 if (!data) return {values,error:"Another leader updated this record or your access changed. Reload before saving."};
 // Database triggers record the mutation atomically, including writes made outside this form.
 revalidatePath("/prospects");
 revalidatePath("/prospects/" + prospectId);
 revalidatePath("/dashboard");
 redirect("/prospects/" + prospectId + "?season=" + season.year);
}
