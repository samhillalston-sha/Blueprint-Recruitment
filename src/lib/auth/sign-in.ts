import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export type SignInState = { status: "idle" | "success" | "error"; message: string };
export const initialSignInState: SignInState = { status: "idle", message: "" };
export const genericSignInMessage = "If this address has been invited, you’ll receive a sign-in link. Check your inbox and spam folder.";
export function magicLinkOptions(appOrigin: string) {
  return { shouldCreateUser: false, emailRedirectTo: `${appOrigin}/auth/callback` };
}

export function confirmationInput(url: URL): { token_hash: string; type: "email" | "invite" } | null {
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!token_hash || token_hash.length > 512 || (type !== "email" && type !== "invite")) return null;
  return { token_hash, type };
}
