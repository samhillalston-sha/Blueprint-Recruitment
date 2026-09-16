export type Identity = { id: string; email?: string };
export type LeadershipProfile = { id: string; full_name: string; email: string | null; is_active: boolean };
export type AccessResult =
  | { status: "authorized"; user: Identity; profile: LeadershipProfile }
  | { status: "unauthenticated" | "denied" | "unavailable" };

export async function evaluateAccess(
  readIdentity: () => Promise<Identity | null>,
  readProfile: (id: string) => Promise<LeadershipProfile | null>,
): Promise<AccessResult> {
  try {
    const user = await readIdentity();
    if (!user) return { status: "unauthenticated" };
    const profile = await readProfile(user.id);
    if (!profile || profile.id !== user.id || profile.is_active !== true) return { status: "denied" };
    return { status: "authorized", user, profile };
  } catch { return { status: "unavailable" }; }
}

export function isProtectedPath(path: string): boolean {
  return ["/dashboard", "/prospects", "/settings"].some(root => path === root || path.startsWith(`${root}/`));
}

export function loginReason(status: Exclude<AccessResult["status"], "authorized">): string {
  return status === "denied" ? "access" : status === "unavailable" ? "unavailable" : "signin";
}
