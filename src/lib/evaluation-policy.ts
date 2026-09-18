import { z } from "zod";

export const evaluationAttributes = [
 {key:"athleticism",label:"Athleticism"},
 {key:"offensive_ability",label:"Offensive Ability"},
 {key:"defensive_ability",label:"Defensive Ability"},
 {key:"coachability",label:"Coachability"},
 {key:"on_field_vibes",label:"On Field Vibes"},
 {key:"off_field_vibes",label:"Off Field Vibes"},
] as const;
export type EvaluationAttribute = typeof evaluationAttributes[number]["key"];
const rating = z.enum(["na","1","2","3","4","5"],{error:"Choose 1–5 or N/A for every attribute."}).transform(value=>value === "na" ? null : Number(value));
export const evaluationSchema = z.object({athleticism:rating,offensive_ability:rating,defensive_ability:rating,coachability:rating,on_field_vibes:rating,off_field_vibes:rating});
export type EvaluationRatings = z.output<typeof evaluationSchema>;
export type Evaluation = EvaluationRatings & {id:string;candidacy_id:string;evaluator_id:string;evaluator_name:string;version:number;created_at:string;updated_at:string};
export type EvaluationSummary = {count:number;page:number;rows:Evaluation[];own:Evaluation|null;averages:Record<EvaluationAttribute,{mean:number|null;count:number;na:number}>};
export type EvaluationFormState = {error?:string;values?:Record<string,string>};
export type EvaluationAction = (previous:EvaluationFormState,form:FormData)=>Promise<EvaluationFormState>;
export function evaluationPage(value: string | undefined) {return value && /^[0-9]{1,6}$/.test(value) ? Math.max(1,Number(value)) : 1;}
export function displayRating(value:number|null) {return value === null ? "N/A" : String(value);}
