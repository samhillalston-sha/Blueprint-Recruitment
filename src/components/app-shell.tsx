import { Suspense } from "react";
import { LockKeyhole, LogOut, MapPin } from "lucide-react";
import { Brand } from "./brand";
import { WorkspaceNavigation } from "./workspace-navigation";
import { SeasonSelector } from "./season-selector";
import { signOut } from "@/app/login/actions";
import type { LeadershipProfile } from "@/lib/auth/policy";
import type { Season } from "@/lib/season-policy";

export function AppShell({ children, profile, seasons }: { children: React.ReactNode; profile: LeadershipProfile; seasons: Season[] }) {
  const name = profile.full_name || profile.email || "Leadership member";
  const initials = (profile.full_name || "BP").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <div className="workspace">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="workspace-sidebar">
      <div className="sidebar-brand"><Brand compact /></div>
      <div className="hidden px-7 pt-10 pb-3 text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase lg:block">Recruiting workspace</div>
      <Suspense fallback={<div className="px-7 text-sm text-slate-400">Loading navigation…</div>}><WorkspaceNavigation /></Suspense>
      <div className="sidebar-bottom">
        <div className="mb-6 flex items-center gap-2 text-[10px] font-medium tracking-wide text-slate-400"><MapPin size={12} /> New York, NY <span className="ml-auto">NYC / BP</span></div>
        <div className="flex items-center gap-3 border-t border-white/10 pt-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-300/20 bg-blue-400/10 text-xs font-bold text-blue-200">{initials}</div><div className="min-w-0"><p className="truncate text-xs font-semibold" title={name}>{name}</p><p className="mt-1 text-[10px] text-slate-400">Team leadership</p></div><form action={signOut} className="ml-auto"><button type="submit" aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-300"><LogOut size={16} /></button></form></div>
      </div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-header"><div><span className="text-xs font-medium text-muted-foreground">NYC Blueprint</span><span className="mx-3 text-border">/</span><span className="text-xs font-semibold">Recruiting</span></div><div className="flex items-center gap-5"><span className="hidden items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground sm:flex"><LockKeyhole size={12} /> PRIVATE WORKSPACE</span><Suspense fallback={<span className="text-sm text-muted-foreground">Loading seasons…</span>}><SeasonSelector seasons={seasons} /></Suspense></div></header>
      <main id="main-content" className="workspace-main" tabIndex={-1}>{children}</main>
      <footer className="workspace-footer"><span>Blueprint Recruiting</span><span>Build for the long game.</span></footer>
    </div>
  </div>;
}
