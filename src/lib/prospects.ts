import "server-only";
import { notFound } from "next/navigation";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { isUuid, escapeSearch, type Prospect } from "./prospect-policy";
import type { Candidacy } from "./workflow-policy";
export type ListedProspect = Prospect & { candidacies?: Pick<Candidacy,"season_id" | "outcome" | "stage" | "priority" | "owner_id" | "next_action" | "follow_up_date">[] };

export const prospectColumns = "id,full_name,email,phone,social_url,location,teams,age,height_cm,position,created_at,updated_at";
export async function getProspect(id: string) {
 if (!isUuid(id)) notFound();
 const { client } = await requireLeadership();
 const { data, error } = await client.from("prospects").select(prospectColumns).eq("id", id).maybeSingle();
 if (error) throw new Error("Prospect information is temporarily unavailable.");
 if (!data) notFound();
 return data as Prospect;
}
export async function listProspects(seasonId: string | null, search: string, page: number, all: boolean) {
 const { client } = await requireLeadership();
 const fields = "season_id,outcome,stage,priority,owner_id,next_action,follow_up_date";
 const selection = prospectColumns + (all ? ",candidacies(" : ",candidacies!inner(") + fields + ")";
 let query = client.from("prospects").select(selection, { count: "exact" });
 if (!all) {
  if (!seasonId) return { rows: [] as ListedProspect[], count: 0 };
  query = query.eq("candidacies.season_id", seasonId);
 }
 if (all && seasonId) query = query.eq("candidacies.season_id",seasonId);
 if (search) query = query.ilike("full_name", "%" + escapeSearch(search.slice(0,120)) + "%");
 const { data, error, count } = await query.order("full_name").order("id").range((page-1)*50, page*50-1);
 if (error) throw new Error("The prospect database is temporarily unavailable.");
 return { rows: (data ?? []) as unknown as ListedProspect[], count: count ?? 0 };
}
