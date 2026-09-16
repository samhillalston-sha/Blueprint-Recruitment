export type RuntimeConfig = { supabaseUrl: string; publishableKey: string; appOrigin: string };

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function readRuntimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig | null {
  if ((env.APP_ENV ?? "private") !== "private") return null;
  const supabaseUrl = origin(env.SUPABASE_URL);
  const appOrigin = origin(env.APP_URL);
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  // Modern publishable keys only: legacy JWTs and privileged keys are rejected.
  if (!supabaseUrl || !appOrigin || !publishableKey?.startsWith("sb_publishable_")) return null;
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return null;
  return { supabaseUrl, appOrigin, publishableKey };
}
