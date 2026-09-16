import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readRuntimeConfig } from "@/lib/config";

export async function createClient() {
  const config = readRuntimeConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Read-only Server Components: proxy persists refreshed cookies. */ }
      },
    },
  });
}
