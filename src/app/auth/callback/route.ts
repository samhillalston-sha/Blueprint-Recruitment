import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readRuntimeConfig } from "@/lib/config";
import { finishSignIn } from "@/lib/auth/finish-sign-in";

export async function GET(request: NextRequest) {
  const config = readRuntimeConfig();
  let path = config ? "/login?reason=link" : "/login?reason=setup";
  const code = request.nextUrl.searchParams.get("code");
  try {
    const client = await createClient();
    if (client && code && code.length <= 512) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) path = await finishSignIn(client);
    }
  } catch { path = "/login?reason=unavailable"; }
  // Never accept a user-controlled `next` URL or forwarded-host origin.
  return NextResponse.redirect(new URL(path, config?.appOrigin ?? request.url), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
