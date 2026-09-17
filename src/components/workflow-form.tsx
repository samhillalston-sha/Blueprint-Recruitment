"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { stages, priorities, type Candidacy, type RecruitingLeader, type WorkflowAction, type WorkflowFormState } from "@/lib/workflow-policy";

export function WorkflowForm({ candidacy, leaders, year, saveAction }: { candidacy: Candidacy; leaders: RecruitingLeader[]; year: number; saveAction: WorkflowAction }) {
 const permalink = "/prospects/" + candidacy.prospect_id + "?season=" + year;
 const [state, action, pending] = useActionState(saveAction, {} as WorkflowFormState, permalink);
 const value = (key: keyof Candidacy) => state.values?.[key] ?? candidacy[key] ?? "";
 return <form action={action} className="space-y-6 p-6">
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
   <label className="text-sm font-medium">Recruiting stage<select name="stage" defaultValue={String(value("stage"))} className="mt-2 h-10 w-full rounded-md border border-border px-3">{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label>
   <label className="text-sm font-medium">Priority<select name="priority" defaultValue={String(value("priority"))} className="mt-2 h-10 w-full rounded-md border border-border px-3"><option value="">Not set</option>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
   <label className="text-sm font-medium">Owner<select name="owner_id" defaultValue={String(value("owner_id"))} className="mt-2 h-10 w-full rounded-md border border-border px-3"><option value="">Unassigned</option>{leaders.map(leader => <option key={leader.id} value={leader.id} disabled={!leader.is_active && leader.id !== candidacy.owner_id}>{leader.full_name || "Leadership member"}{!leader.is_active ? " (inactive)" : ""}</option>)}</select></label>
   <label className="text-sm font-medium sm:col-span-2">Next action<textarea name="next_action" defaultValue={String(value("next_action"))} maxLength={500} rows={2} className="mt-2 w-full rounded-md border border-border p-3" placeholder="What should happen next?" /></label>
   <label className="text-sm font-medium">Follow-up date<input name="follow_up_date" type="date" defaultValue={String(value("follow_up_date"))} min="2000-01-01" max="2100-12-31" className="mt-2 h-10 w-full rounded-md border border-border px-3" /></label>
  </div>
  <fieldset><legend className="text-sm font-semibold">Three-year projections</legend><p className="mt-2 text-xs leading-5 text-muted-foreground">Your qualitative outlook for this player. Leave unknown projections blank; each season keeps its own outlook.</p>
   <div className="mt-4 grid gap-5 lg:grid-cols-3">{(["projection_year_one","projection_year_two","projection_year_three"] as const).map((key,index) => <label key={key} className="text-sm font-medium">{year+index} · Year {index+1}<textarea name={key} defaultValue={String(value(key))} maxLength={1000} rows={4} className="mt-2 w-full rounded-md border border-border p-3" /></label>)}</div>
  </fieldset>
  {state.error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{state.error}</p><a className="mt-2 inline-block underline" href={permalink}>Reload profile</a></div>}
  <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save recruiting details"}</Button><p className="text-xs text-muted-foreground">Changes are recorded automatically in the activity timeline.</p></div>
 </form>;
}
