import Link from "next/link";
import { requireLeadership } from "@/lib/auth/require-leadership";
import { getSeasons } from "@/lib/seasons";
import { selectSeason } from "@/lib/season-policy";
import { getProspect } from "@/lib/prospects";
import { ProspectForm } from "@/components/prospect-form";
import { saveProspect } from "../../actions";
export const metadata = { title: "Edit prospect" };
export default async function EditProspect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
 await requireLeadership();
 const person = await getProspect((await params).id);
 const season = selectSeason(await getSeasons(),(await searchParams).season);
 return <div><div className="page-heading"><div><span className="eyebrow text-primary">Shared prospect facts</span><h1>Edit {person.full_name}.</h1><p>Changes to player facts appear in every season.</p></div></div>
 {season?.status === "active" ? <ProspectForm prospect={person} saveAction={saveProspect.bind(null,person.id,season.id)} year={season.year} /> : <div className="panel mt-6 p-6"><p>Historical seasons are read-only. Choose an active season to edit shared player facts.</p><Link className="mt-4 block text-primary underline" href={"/prospects/" + person.id + (season ? "?season=" + season.year : "")}>Back to profile</Link></div>}</div>;
}
