"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readRuntimeConfig } from "@/lib/config";
import { googleOAuthOptions, safeGoogleOAuthUrl, type SignInState } from "@/lib/auth/sign-in";

export async function signInWithGoogle(_previous: SignInState, _form: FormData): Promise<SignInState> {
  const config = readRuntimeConfig();
  if (!config) return { status: "error", message: "Sign-in isn’t configured yet. Contact your workspace administrator." };
  let destination: string | null = null;
  try {
    const client = await createClient();
    if (!client) return { status: "error", message: "Sign-in isn’t configured yet. Contact your workspace administrator." };
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: googleOAuthOptions(config.appOrigin) });
    if (!error) destination = safeGoogleOAuthUrl(data.url, config.supabaseUrl, config.appOrigin);
  } catch {
    return { status: "error", message: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
  if (!destination) return { status: "error", message: "We couldn’t start Google sign-in. Please try again or contact your workspace administrator." };
  // Next redirect throws internally; keep it outside the provider-error catch.
  redirect(destination);
}

export async function signOut() {
  const client = await createClient();
  let failed = false;
  if (client) {
    try { const { error } = await client.auth.signOut({ scope: "local" }); failed = Boolean(error); }
    catch { failed = true; }
  }
  redirect(failed ? "/login?reason=signout-error" : "/login");
}
