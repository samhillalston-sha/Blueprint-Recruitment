export type SignInState = { status: "idle" | "error"; message: string };
export const initialSignInState: SignInState = { status: "idle", message: "" };
export function googleOAuthOptions(appOrigin: string) {
  return {
    redirectTo: `${appOrigin}/auth/callback`,
    skipBrowserRedirect: true,
    scopes: "openid email profile",
    queryParams: { prompt: "select_account" },
  };
}

export function safeGoogleOAuthUrl(value: string | null, supabaseUrl: string, appOrigin: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin || url.username || url.password || url.hash) return null;
    if (url.pathname !== "/auth/v1/authorize" || url.searchParams.get("provider") !== "google") return null;
    if (url.searchParams.getAll("provider").length !== 1 || url.searchParams.getAll("redirect_to").length !== 1) return null;
    if (url.searchParams.get("redirect_to") !== `${appOrigin}/auth/callback`) return null;
    return url.toString();
  } catch { return null; }
}
