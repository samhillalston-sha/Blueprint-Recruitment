"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { isUuid } from "@/lib/prospect-policy";
import { evaluationAttributes,evaluationSchema,type EvaluationFormState } from "@/lib/evaluation-policy";

export async function saveEvaluation(prospectId:string,seasonId:string,candidacyId:string,expectedVersion:number,_previous:EvaluationFormState,form:FormData):Promise<EvaluationFormState> {
 const {client,user}=await requireLeadership();
 const raw=Object.fromEntries(evaluationAttributes.map(({key})=>[key,form.get(key)??""]));
 const values=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,String(value).slice(0,10)]));
 if(![prospectId,seasonId,candidacyId].every(isUuid)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0) return {values,error:"Invalid evaluation record."};
 const parsed=evaluationSchema.safeParse(raw);
 if(!parsed.success) return {values,error:"Choose 1–5 or N/A for every attribute."};
 const [{data:season,error:seasonError},{data:candidacy,error:candidacyError}]=await Promise.all([
  client.from("seasons").select("id,year,status").eq("id",seasonId).maybeSingle(),
  client.from("candidacies").select("id").eq("id",candidacyId).eq("prospect_id",prospectId).eq("season_id",seasonId).maybeSingle(),
 ]);
 if(seasonError||candidacyError||!season||!candidacy) return {values,error:"Season record is unavailable. Reload and try again."};
 if(season.status!=="active") return {values,error:"Historical seasons are read-only. Choose an active season."};
 const query=expectedVersion===0
  ? client.from("evaluations").insert({candidacy_id:candidacyId,...parsed.data})
  : client.from("evaluations").update(parsed.data).eq("candidacy_id",candidacyId).eq("evaluator_id",user.id).eq("version",expectedVersion);
 const {data,error}=await query.select("id").maybeSingle();
 if(error?.code==="23505"||(!error&&!data)) return {values,error:"Your evaluation changed in another tab. Reload the profile before saving."};
 if(error) return {values,error:"Could not save your evaluation. Your approval or the season may have changed; reload and try again."};
 revalidatePath("/prospects/"+prospectId);
 revalidatePath("/dashboard");
 redirect("/prospects/"+prospectId+"?season="+season.year+"#evaluations");
}
