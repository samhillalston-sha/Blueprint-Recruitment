import "server-only";
import { requireLeadership } from "./auth/require-leadership";
import type { EvaluationSummary } from "./evaluation-policy";

export async function getEvaluations(candidacyId:string,page:number):Promise<EvaluationSummary> {
 const {client}=await requireLeadership();
 const {data,error}=await client.rpc("evaluation_summary",{p_candidacy_id:candidacyId,p_page:page});
 if(error||!data) throw new Error("Evaluations are temporarily unavailable.");
 return data as EvaluationSummary;
}
