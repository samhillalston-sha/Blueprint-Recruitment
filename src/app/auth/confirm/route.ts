import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readRuntimeConfig } from "@/lib/config";
import { confirmationInput } from "@/lib/auth/sign-in";
import { finishSignIn } from "@/lib/auth/finish-sign-in";

export async function GET(request: NextRequest) {
  const config = readRuntimeConfig();
  let path = config ? "/login?reason=link" : "/login?reason=setup";
  try {
    const input = confirmationInput(request.nextUrl);
    const client = await createClient();
    if (client && input) {
      const { error } = await client.auth.verifyOtp(input);
      if (!error) path = await finishSignIn(client);
    }
  } catch { path = "/login?reason=unavailable"; }
  return NextResponse.redirect(new URL(path, config?.appOrigin ?? request.url), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
