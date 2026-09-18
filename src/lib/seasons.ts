import "server-only";
import { cache } from "react";
import { requireLeadership } from "@/lib/auth/require-leadership";
import type { Season } from "./season-policy";

export const getSeasons = cache(async (): Promise<Season[]> => {
  const { client } = await requireLeadership();
  const { data, error } = await client.from("seasons").select("id, name, year, is_current, status, closed_at, closed_by_name").order("year", { ascending: false });
  if (error) throw new Error("Season information is temporarily unavailable.");
  return (data ?? []) as Season[];
});
