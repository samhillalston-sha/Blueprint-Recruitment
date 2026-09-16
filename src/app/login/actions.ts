"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readRuntimeConfig } from "@/lib/config";
import { emailSchema, genericSignInMessage, magicLinkOptions, type SignInState } from "@/lib/auth/sign-in";

export async function requestMagicLink(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };
  const config = readRuntimeConfig();
  const client = await createClient();
  if (!config || !client) return { status: "error", message: "Sign-in isn’t configured yet. Contact your workspace administrator." };
  try {
    const { error } = await client.auth.signInWithOtp({ email: email.data, options: magicLinkOptions(config.appOrigin) });
    if (error && !["signup_disabled", "user_not_found"].includes(error.code ?? "")) {
      return { status: "error", message: "We couldn’t send a sign-in link. Wait a minute and try again, or contact your workspace administrator." };
    }
    // Same response for known and unknown addresses: don't expose membership.
    return { status: "success", message: genericSignInMessage };
  } catch {
    return { status: "error", message: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
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
