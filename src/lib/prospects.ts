import "server-only";
import { notFound } from "next/navigation";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { isUuid, escapeSearch, type Prospect } from "./prospect-policy";

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
 const selection = all ? prospectColumns : prospectColumns + ",candidacies!inner(season_id)";
 let query = client.from("prospects").select(selection, { count: "exact" });
 if (!all) {
  if (!seasonId) return { rows: [] as Prospect[], count: 0 };
  query = query.eq("candidacies.season_id", seasonId);
 }
 if (search) query = query.ilike("full_name", "%" + escapeSearch(search.slice(0,120)) + "%");
 const { data, error, count } = await query.order("full_name").order("id").range((page-1)*50, page*50-1);
 if (error) throw new Error("The prospect database is temporarily unavailable.");
 return { rows: (data ?? []) as unknown as Prospect[], count: count ?? 0 };
}
