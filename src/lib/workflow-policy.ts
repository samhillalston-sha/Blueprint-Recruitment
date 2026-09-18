import { z } from "zod";

export const stages = ["Unknown Prospect", "Known Prospect", "Confirmed for Tryouts"] as const;
export const priorities = ["High", "Medium", "Low"] as const;
const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null);
export function validFollowUpDate(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "2100-12-31") return false;
 const date = new Date(value + "T00:00:00Z");
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export const workflowSchema = z.object({
 stage: z.enum(stages),
 priority: z.enum(["", ...priorities]).transform(value => value || null),
 owner_id: z.string().refine(value => !value || z.uuid().safeParse(value).success, "Choose an approved owner.").transform(value => value || null),
 next_action: optionalText(500),
 follow_up_date: z.string().refine(value => !value || validFollowUpDate(value), "Enter a valid follow-up date between 2000 and 2100.").transform(value => value || null),
 projection_year_one: optionalText(1000),
 projection_year_two: optionalText(1000),
 projection_year_three: optionalText(1000),
});
export type WorkflowFacts = z.output<typeof workflowSchema>;
export type Candidacy = WorkflowFacts & { id: string; prospect_id: string; season_id: string; created_at: string; updated_at: string; version: number; outcome: string | null };
export type RecruitingLeader = { id: string; full_name: string; is_active: boolean };
export type WorkflowFormState = { error?: string; values?: Record<string,string> };
export type WorkflowAction = (previous: WorkflowFormState, form: FormData) => Promise<WorkflowFormState>;
export type Activity = {
 id: string; season_id: string | null; actor_name: string; event_type: "prospect_created" | "prospect_updated" | "season_added" | "workflow_updated" | "evaluation_submitted" | "evaluation_updated";
 created_at: string; changes: Record<string,{ from: string | number | null; to: string | number | null; from_label?: string | null; to_label?: string | null }>;
};
export const fieldLabels: Record<string,string> = {
 athleticism:"Athleticism",offensive_ability:"Offensive Ability",defensive_ability:"Defensive Ability",coachability:"Coachability",on_field_vibes:"On Field Vibes",off_field_vibes:"Off Field Vibes",
 full_name: "Name", email: "Email", phone: "Phone", social_url: "Social / profile link", location: "Location", teams: "Teams", age: "Age", height_cm: "Height (cm)", position: "Position",
 outcome: "Season outcome", stage: "Stage", priority: "Priority", owner_id: "Owner", next_action: "Next action", follow_up_date: "Follow-up date",
 projection_year_one: "Year 1 projection", projection_year_two: "Year 2 projection", projection_year_three: "Year 3 projection",
};
export const eventLabels = { prospect_created: "Prospect created", prospect_updated: "Player facts updated", season_added: "Added to season", workflow_updated: "Recruiting workflow updated", evaluation_submitted:"Evaluation submitted",evaluation_updated:"Evaluation updated" };
export function followUpStatus(date: string | null, today = new Date().toISOString().slice(0,10)) {
 if (!date) return null;
 return date < today ? "Overdue" : date === today ? "Due today" : "Upcoming";
}
