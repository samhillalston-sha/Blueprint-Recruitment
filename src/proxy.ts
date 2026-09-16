import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readRuntimeConfig } from "@/lib/config";
import { authorizeClient } from "@/lib/auth/authorize";
import { loginReason } from "@/lib/auth/policy";

export async function proxy(request: NextRequest) {
  const runtime = readRuntimeConfig();
  if (!runtime) return NextResponse.redirect(new URL("/login?reason=setup", request.url));
  let response = NextResponse.next({ request });
  const client = createServerClient(runtime.supabaseUrl, runtime.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const access = await authorizeClient(client);
  if (access.status !== "authorized") {
    const target = new URL(`/login?reason=${loginReason(access.status)}`, runtime.appOrigin);
    const denied = NextResponse.redirect(target);
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    response = denied;
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

// Explicit subtrees: extensions/nested paths must never bypass the guard.
export const config = { matcher: ["/dashboard/:path*", "/prospects/:path*", "/settings/:path*"] };
