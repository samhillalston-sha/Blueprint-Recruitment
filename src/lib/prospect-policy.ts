import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null);
const optionalInteger = (min: number, max: number) => z.string().trim()
 .refine(value => !value || /^\d+$/.test(value), "Enter a whole number.")
 .transform(value => value ? Number(value) : null)
 .refine(value => value === null || (value >= min && value <= max), `Enter a value between ${min} and ${max}.`);
export const prospectSchema = z.object({
 full_name: z.string().trim().min(1, "Name is required.").max(120),
 email: optionalText(254).refine(value => !value || z.email().safeParse(value).success, "Enter a valid email."),
 phone: optionalText(40),
 social_url: optionalText(500).refine(value => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
 }, "Use a full http or https URL."),
 location: optionalText(120), teams: optionalText(500),
 age: optionalInteger(16, 100), height_cm: optionalInteger(100, 250),
 position: z.enum(["", "Handler", "Cutter"]).transform(value => value || null),
});
export type ProspectFacts = z.output<typeof prospectSchema>;
export type Prospect = ProspectFacts & { id: string; created_at: string; updated_at: string };
export type Duplicate = { id: string; full_name: string };
export type ProspectFormState = { error?: string; duplicates?: Duplicate[]; values?: Record<string, string> };
export function normalizeName(name: string) { return name.trim().replace(/\s+/g, " ").toLowerCase(); }
export function parseProspect(form: FormData) {
 return prospectSchema.safeParse(Object.fromEntries(Object.keys(prospectSchema.shape).map(key => [key, form.get(key) ?? ""])));
}
export function escapeSearch(value: string) { return value.replace(/[\\%_]/g, "\\$&"); }
export const isUuid = (value: string) => z.uuid().safeParse(value).success;
