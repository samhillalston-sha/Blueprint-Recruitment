import Link from "next/link";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { ProspectForm } from "@/components/prospect-form";
import { saveProspect } from "../actions";
export const metadata = { title: "Create prospect" };
export default async function NewProspect({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
 await requireLeadership();
 const season = selectSeason(await getSeasons(),(await searchParams).season);
 return <div><div className="page-heading"><div><span className="eyebrow text-primary">{season?.name ?? "No season"}</span><h1>Create prospect.</h1><p>A new person record, linked to this recruiting season.</p></div></div>
 {season?.status === "active" ? <ProspectForm saveAction={saveProspect.bind(null,null,season.id)} year={season.year} /> : <div className="panel mt-6 p-6"><p>Historical seasons are read-only. Choose an active season to create a prospect.</p><Link className="mt-4 block text-primary underline" href="/prospects">Back to prospects</Link></div>}</div>;
}
