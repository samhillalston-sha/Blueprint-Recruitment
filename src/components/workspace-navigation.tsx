"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, UsersRound, Settings2 } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function WorkspaceNavigation() {
  const pathname = usePathname();
  const season = useSearchParams().get("season");
  return <nav className="workspace-nav" aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={season ? `${href}?season=${encodeURIComponent(season)}` : href} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{active && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-blue-300 lg:block" />}</Link>;
  })}</nav>;
}
