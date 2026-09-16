import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireLeadership();
  const seasons = await getSeasons();
  return <AppShell profile={profile} seasons={seasons}>{children}</AppShell>;
}
