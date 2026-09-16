import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authorizeClient } from "./authorize";
import { loginReason } from "./policy";

export const requireLeadership = cache(async () => {
  const client = await createClient();
  if (!client) redirect("/login?reason=setup");
  const access = await authorizeClient(client);
  if (access.status !== "authorized") redirect(`/login?reason=${loginReason(access.status)}`);
  return { client, user: access.user, profile: access.profile };
});
