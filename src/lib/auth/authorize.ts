import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAccess, type LeadershipProfile } from "./policy";

export function authorizeClient(client: SupabaseClient) {
  return evaluateAccess(async () => {
    // Contact Auth rather than trusting an unverified session cookie.
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError") return null;
      throw error;
    }
    return data.user ? { id: data.user.id, email: data.user.email } : null;
  }, async id => {
    const { data, error } = await client.from("profiles")
      .select("id, full_name, email, is_active").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as LeadershipProfile | null;
  });
}
