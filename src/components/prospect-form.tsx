"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeName, type Prospect, type ProspectFormState } from "@/lib/prospect-policy";
import { saveProspect, addToSeason } from "@/app/(workspace)/prospects/actions";

export function ProspectForm({ prospect, seasonId, year }: { prospect?: Prospect; seasonId: string; year: number }) {
 const [state, action, pending] = useActionState(saveProspect.bind(null, prospect?.id ?? null, seasonId), {} as ProspectFormState, (prospect ? "/prospects/" + prospect.id + "/edit" : "/prospects/new") + "?season=" + year);
 const fields = [
  ["full_name","Full name","text",120], ["email","Email","email",254], ["phone","Phone","tel",40],
  ["social_url","Social / profile link","url",500], ["location","Location","text",120], ["teams","Current / previous teams","text",500],
  ["age","Age","number",undefined], ["height_cm","Height (cm)","number",undefined],
 ] as const;
 return <form action={action} className="panel mt-6 p-6">
  <p className="mb-6 text-sm text-muted-foreground">Only a name is required. Leave unknown facts blank. These details are shared across every season.</p>
  <div className="grid gap-5 sm:grid-cols-2">{fields.map(([key,label,type,max]) => <label key={key} className="text-sm font-medium">{label}{key === "full_name" ? " *" : ""}
   <Input className="mt-2" name={key} type={type} defaultValue={state.values?.[key] ?? prospect?.[key] ?? ""} required={key === "full_name"} maxLength={max}
    min={key === "age" ? 16 : key === "height_cm" ? 100 : undefined} max={key === "age" ? 100 : key === "height_cm" ? 250 : undefined} step={type === "number" ? 1 : undefined} />
  </label>)}
  <label className="text-sm font-medium">Position<select name="position" defaultValue={state.values?.position ?? prospect?.position ?? ""} className="mt-2 h-10 w-full rounded-md border border-border px-3">
   <option value="">Unknown</option><option value="Handler">Handler</option><option value="Cutter">Cutter</option>
  </select></label></div>
  {state.error && <p role="alert" className="mt-5 text-sm text-red-700">{state.error}</p>}
  {state.duplicates?.length ? <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
   <ul className="space-y-2">{state.duplicates.map(person => <li key={person.id}><Link className="text-sm font-semibold text-primary underline" href={"/prospects/" + person.id + "?season=" + year}>Open {person.full_name}</Link></li>)}</ul>
   <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" name="confirm_duplicate" value={normalizeName(state.duplicates[0].full_name)} className="mt-1" />This is a different person with the same name. Save a separate record.</label>
  </div> : null}
  <div className="mt-6 flex gap-3"><Button type="submit" disabled={pending}>{pending ? "Saving…" : prospect ? "Save changes" : "Create prospect"}</Button>
   <Button asChild variant="outline"><Link href={prospect ? "/prospects/" + prospect.id + "?season=" + year : "/prospects?season=" + year}>Cancel</Link></Button></div>
 </form>;
}
export function AddToSeason({ prospectId, seasonId }: { prospectId: string; seasonId: string }) {
 const [state, action, pending] = useActionState(addToSeason.bind(null,prospectId,seasonId), {} as ProspectFormState);
 return <form action={action}><Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add to this season"}</Button>{state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}</form>;
}
