"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { evaluationAttributes,type Evaluation,type EvaluationAction,type EvaluationFormState } from "@/lib/evaluation-policy";

export function EvaluationForm({own,saveAction,profileUrl}:{own:Evaluation|null;saveAction:EvaluationAction;profileUrl:string}) {
 const [state,action,pending]=useActionState(saveAction,{} as EvaluationFormState,profileUrl);
 return <form action={action} className="space-y-5 p-6" aria-label="Your evaluation">
  <div><h3 className="text-sm font-semibold">{own ? "Edit your evaluation" : "Your evaluation"}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">1–5, with 5 highest. Choose N/A when you cannot assess an attribute. Your evaluation is shared with leadership.</p></div>
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{evaluationAttributes.map(({key,label})=><label key={key} className="text-sm font-medium">{label}<select name={key} required defaultValue={state.values?.[key]??(own ? own[key]===null?"na":String(own[key]) : "")} className="mt-2 h-10 w-full rounded-md border border-border px-3"><option value="" disabled>Choose rating</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}<option value="na">N/A</option></select></label>)}</div>
  {state.error&&<div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{state.error}</p><a className="mt-2 inline-block underline" href={profileUrl}>Reload profile</a></div>}
  <Button type="submit" disabled={pending}>{pending?"Saving…":own?"Update evaluation":"Submit evaluation"}</Button>
 </form>;
}
