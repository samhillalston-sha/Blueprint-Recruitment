import "server-only";
import { cache } from "react";
import { requireLeadership } from "@/lib/auth/require-leadership";
import type { Candidacy, RecruitingLeader, Activity } from "./workflow-policy";

export const candidacyColumns = "id,prospect_id,season_id,created_at,updated_at,version,outcome,stage,priority,owner_id,next_action,follow_up_date,projection_year_one,projection_year_two,projection_year_three";
export const getRecruitingLeaders = cache(async (): Promise<RecruitingLeader[]> => {
 const { client } = await requireLeadership();
 const { data, error } = await client.rpc("recruiting_leaders");
 if (error) throw new Error("Recruiting owners are temporarily unavailable.");
 return (data ?? []) as RecruitingLeader[];
});
export async function getCandidacies(prospectId: string): Promise<Candidacy[]> {
 const { client } = await requireLeadership();
 const { data, error } = await client.from("candidacies").select(candidacyColumns).eq("prospect_id",prospectId);
 if (error) throw new Error("Season history is temporarily unavailable.");
 return (data ?? []) as Candidacy[];
}
export async function getActivity(prospectId: string, page: number) {
 const { client } = await requireLeadership();
 const { data, error, count } = await client.from("prospect_activity")
  .select("id,season_id,actor_name,event_type,created_at,changes",{count:"exact"}).eq("prospect_id",prospectId)
  .order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*25,page*25-1);
 if (error) throw new Error("The activity timeline is temporarily unavailable.");
 return { rows: (data ?? []) as Activity[], count: count ?? 0 };
}
export async function getPipeline(seasonId: string | null) {
 const { client } = await requireLeadership();
 if (!seasonId) return [0,0,0];
 const names = ["Unknown Prospect","Known Prospect","Confirmed for Tryouts"];
 const results = await Promise.all(names.map(stage => client.from("candidacies").select("id",{count:"exact",head:true}).eq("season_id",seasonId).eq("stage",stage)));
 if (results.some(result => result.error)) throw new Error("Pipeline counts are temporarily unavailable.");
 return results.map(result => result.count ?? 0);
}
