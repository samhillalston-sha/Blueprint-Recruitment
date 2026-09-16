import { LockKeyhole, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { SignInForm } from "@/components/sign-in-form";
import { readRuntimeConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
const reasons: Record<string, string> = {
  setup: "Workspace setup is still in progress. Sign-in will be available once Supabase is connected.",
  access: "Your account doesn’t have active leadership access. Ask your workspace administrator to check your invitation.",
  unavailable: "We couldn’t verify your access right now. Please try again shortly.",
  link: "This sign-in link is invalid or expired. Request a new link below.",
  "signout-error": "We couldn’t finish signing you out. Please try again, or close this browser and contact your administrator.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const configured = Boolean(readRuntimeConfig());
  const notice = !configured ? reasons.setup : reason ? reasons[reason] : undefined;
  return <main className="login-layout">
    <section className="login-story blueprint-grid text-white">
      <Brand />
      <div className="relative z-10 my-auto py-20">
        <span className="eyebrow text-blue-200">NYC Blueprint / Leadership workspace</span>
        <h1 className="mt-6 max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.04em] lg:text-6xl">The next chapter<br />starts here<span className="text-blue-300">.</span></h1>
        <p className="mt-6 max-w-sm text-base leading-7 text-blue-100/75">A shared blueprint for finding the people who will shape our team. This season, and the ones after it.</p>
        <div className="mt-10 flex items-center gap-3 text-xs font-medium text-blue-100/65"><span className="h-px w-10 bg-blue-200/40" /> Build for the long game <ArrowUpRight size={14} /></div>
      </div>
      <div className="relative z-10 flex justify-between border-t border-white/15 pt-5 text-[10px] font-semibold tracking-[0.16em] text-blue-100/65 uppercase"><span>New York, NY</span><span>Men’s Club Ultimate</span></div>
    </section>
    <section className="flex min-h-screen items-center justify-center px-7 py-14 lg:px-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 lg:hidden"><Brand /></div>
        <span className="eyebrow text-primary">Blueprint Recruiting</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back.</h2>
        <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">Sign in with your invited email address. We’ll send you a secure link—no password needed.</p>
        {notice && <p role="status" className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">{notice}</p>}
        <SignInForm configured={configured} />
        <div className="mt-9 flex gap-2 border-t border-border pt-6 text-xs leading-5 text-muted-foreground"><LockKeyhole size={15} className="mt-0.5 shrink-0" /><p>Private to Blueprint leadership.<br />Need access? Ask your workspace administrator.</p></div>
      </div>
    </section>
  </main>;
}
