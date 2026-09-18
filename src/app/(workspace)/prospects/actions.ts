"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { parseProspect, normalizeName, isUuid, type ProspectFormState } from "@/lib/prospect-policy";

export async function saveProspect(id: string | null, seasonId: string, _previous: ProspectFormState, form: FormData): Promise<ProspectFormState> {
 const { client } = await requireLeadership();
 const values = Object.fromEntries(["full_name","email","phone","social_url","location","teams","age","height_cm","position"].map(key => [key, String(form.get(key) ?? "").slice(0, 501)]));
 if ((id !== null && !isUuid(id)) || !isUuid(seasonId)) return { values, error: "Invalid prospect or season." };
 // Recheck the actual season, rather than trusting hidden fields or URL context.
 const { data: season, error: seasonError } = await client.from("seasons").select("id,year,status").eq("id",seasonId).maybeSingle();
 if (seasonError || !season) return { values, error: "Season information is unavailable." };
 if (season.status !== "active") return { values, error: "Historical seasons are read-only. Choose an active season." };
 const parsed = parseProspect(form);
 if (!parsed.success) return { values, error: parsed.error.issues[0]?.message ?? "Check the prospect details." };
 let duplicateQuery = client.from("prospects").select("id,full_name").eq("normalized_name", normalizeName(parsed.data.full_name));
 if (id) duplicateQuery = duplicateQuery.neq("id",id);
 const { data: duplicates, error: duplicateError } = await duplicateQuery.limit(10);
 if (duplicateError) return { values, error: "Could not check for duplicate names. Please try again." };
 if (duplicates?.length && form.get("confirm_duplicate") !== normalizeName(parsed.data.full_name)) {
  return { values, error: "This name already exists. Open an existing profile, or confirm that this is a different person.", duplicates };
 }
 let savedId = id;
 if (id) {
  const { data, error } = await client.from("prospects").update(parsed.data).eq("id",id).select("id").maybeSingle();
  if (error || !data) return { values, error: "Could not save this prospect. Your access may have changed; reload and try again." };
 } else {
  const { data, error } = await client.rpc("create_prospect", { p_season_id: seasonId, p_facts: parsed.data });
  if (error || typeof data !== "string") return { values, error: "Could not create this prospect. Please reload and try again." };
  savedId = data;
 }
 revalidatePath("/dashboard");
 revalidatePath("/prospects");
 revalidatePath("/prospects/" + savedId);
 redirect("/prospects/" + savedId + "?season=" + season.year);
}
export async function addToSeason(prospectId: string, seasonId: string, _previous: ProspectFormState, _form: FormData): Promise<ProspectFormState> {
 const { client } = await requireLeadership();
 if (!isUuid(prospectId) || !isUuid(seasonId)) return { error: "Invalid prospect or season." };
 const { data: season, error: seasonError } = await client.from("seasons").select("year,status").eq("id",seasonId).maybeSingle();
 if (seasonError || !season || season.status !== "active") return { error: "Choose an active season to add this prospect." };
 const { error } = await client.from("candidacies").insert({ prospect_id: prospectId, season_id: seasonId });
 if (error && error.code !== "23505") return { error: "Could not add this prospect to the season. Reload and try again." };
 revalidatePath("/dashboard");
 revalidatePath("/prospects");
 revalidatePath("/prospects/" + prospectId);
 redirect("/prospects/" + prospectId + "?season=" + season.year);
}
