"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { outcomes, type HistoryAction, type HistoryFormState } from "@/lib/history-policy";
export function OutcomeForm({outcome, saveAction}: {outcome:string|null;saveAction:HistoryAction}) {
 const [state,action,pending]=useActionState(saveAction,{} as HistoryFormState);
 return <form action={action} className="space-y-4 p-6"><p className="text-sm text-muted-foreground">Record this season’s result separately from recruiting stage. Leave unknown outcomes unset.</p><label className="block text-sm font-medium">Season outcome<select name="outcome" defaultValue={outcome??""} className="mt-2 h-10 w-full rounded-md border border-border px-3"><option value="">Not set</option>{outcomes.map(value=><option key={value}>{value}</option>)}</select></label><Button type="submit" disabled={pending}>{pending?"Saving…":"Save outcome"}</Button>{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}</form>;
}
export function StartSeasonForm({year,startAction}: {year:number;startAction:HistoryAction}) {
 const [state,action,pending]=useActionState(startAction,{} as HistoryFormState);
 return <form action={action} className="space-y-4 p-6"><h3 className="text-sm font-semibold">Start a new season</h3><p className="text-sm text-muted-foreground">Creates an empty active season and makes it current. Previous seasons stay intact; close them separately when recruiting is finished.</p><label className="block text-sm font-medium">New season year<Input name="new_season_year" type="number" required min={year} max={2100} step={1} defaultValue={year} className="mt-2 max-w-xs"/></label><Button type="submit" disabled={pending||year>2100}>{pending?"Starting…":"Start new season"}</Button>{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}</form>;
}
export function CloseSeasonForm({year,closeAction}: {year:number;closeAction:HistoryAction}) {
 const [state,action,pending]=useActionState(closeAction,{} as HistoryFormState);
 return <form action={action} className="mt-4 space-y-3"><p className="text-xs leading-5 text-muted-foreground">Closing freezes seasonal workflow, outcomes and evaluations. Nothing is deleted, copied or assigned an outcome automatically. Shared player facts remain current. Closed seasons cannot be reopened here.</p><label className="block text-sm font-medium">Type {year} to confirm closure<Input name="confirm_year" inputMode="numeric" pattern={String(year)} required placeholder={String(year)} className="mt-2 max-w-xs"/></label><Button variant="outline" type="submit" disabled={pending}>{pending?"Closing…":"Close "+year+" season"}</Button>{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}</form>;
}
