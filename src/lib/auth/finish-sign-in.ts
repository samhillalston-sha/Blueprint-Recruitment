import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeClient } from "./authorize";
import { loginReason } from "./policy";

export async function finishSignIn(client: SupabaseClient): Promise<string> {
  const access = await authorizeClient(client);
  if (access.status === "authorized") return "/dashboard";
  await client.auth.signOut({ scope: "local" });
  return `/login?reason=${loginReason(access.status)}`;
}
